import { parse } from "csv";
import {
  Logger,
  RefreshableInteropToken,
  delay,
  waitForReadModelMetadataVersion,
} from "pagopa-interop-commons";
import { CorrelationId, Tenant, WithMetadata } from "pagopa-interop-models";
import { InteropContext } from "../model/interopContextModel.js";
import { JobStats } from "../model/istatModel.js";
import { TenantProcessService } from "./tenantProcessService.js";
import { IstatClient } from "./istatClient.js";
import { AttributeProcessService } from "./attributeProcessService.js";
import {
  ISTAT_CERTIFIER_ORIGIN,
  ISTAT_POPULATION_ATTRIBUTE_CODE,
  SUMMARY_AGE_CODE,
} from "../config/constants.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";
import { Readable } from "stream";
import { config } from "../config/config.js";

type PollingConfig = {
  defaultPollingMaxRetries: number;
  defaultPollingRetryDelay: number;
};

const sliceIntoChunks = <T>(arr: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
};

export async function importAttributes(
  istatClient: IstatClient,
  readModel: ReadModelServiceSQL,
  tenantProcess: TenantProcessService,
  attributeProcess: AttributeProcessService,
  refreshableToken: RefreshableInteropToken,
  pollingConfig: PollingConfig,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  logger.info("ISTAT Certified discrete attributes importer started");
  const stats: JobStats = { processed: 0, created: 0, revoked: 0, errors: 0 };

  await ensureAttributeExists(
    readModel,
    attributeProcess,
    refreshableToken,
    correlationId,
    logger,
    pollingConfig
  );

  const populationByMunicipality = await downloadAndAggregateData(
    istatClient,
    logger
  );
  logger.info(
    `Found ${populationByMunicipality.size} municipalities on ISTAT file.`
  );

  const entries = Array.from(populationByMunicipality.entries());
  const chunks = sliceIntoChunks(entries, config.csvChunkSize);

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async ([municipalityCode, totalCount]) => {
        stats.processed++;
        try {
          const token = await refreshableToken.get();
          const context: InteropContext = {
            correlationId,
            bearerToken: token.serialized,
          };

          const metadata =
            await tenantProcess.internalAssignCertifiedDiscreteAttribute(
              ISTAT_CERTIFIER_ORIGIN,
              municipalityCode,
              ISTAT_CERTIFIER_ORIGIN,
              ISTAT_POPULATION_ATTRIBUTE_CODE,
              totalCount,
              context,
              logger
            );

          if (metadata) {
            stats.created++;
          }
        } catch (error) {
          logger.error(
            `Error assign certified attribute for municipality ${municipalityCode}: ${error}`
          );
          stats.errors++;
        }
      })
    );
  }

  await revokeMissingMunicipalities(
    readModel,
    tenantProcess,
    refreshableToken,
    populationByMunicipality,
    pollingConfig,
    stats,
    logger,
    correlationId
  );

  logger.info(
    `Process complete. Processed: ${stats.processed}, Success: ${stats.created}, Error: ${stats.errors}`
  );
}

async function downloadAndAggregateData(
  istatClient: IstatClient,
  logger: Logger
): Promise<Map<string, number>> {
  const fileContent = await istatClient.downloadNationalDataset(logger);
  const populationMap = new Map<string, number>();

  const parser = Readable.from(fileContent).pipe(
    parse({
      trim: true,
      columns: true,
      delimiter: ";",
      relax_quotes: true,
      from_line: 2,
      relax_column_count: true,
    })
  );

  for await (const row of parser) {
    if (Number(row["Età"]) === SUMMARY_AGE_CODE) {
      const codiceComune = row["Codice comune"];
      const totale = Number(row["Totale"]);
      if (codiceComune && !isNaN(totale)) {
        populationMap.set(codiceComune, totale);
      }
    }
  }

  return populationMap;
}
async function revokeMissingMunicipalities(
  readModel: ReadModelServiceSQL,
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  populationByMunicipality: Map<string, number>,
  pollingConfig: PollingConfig,
  stats: JobStats,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  const tenantsWithAttribute = await readModel.getTenantsWithDiscreteAttribute(
    ISTAT_CERTIFIER_ORIGIN,
    ISTAT_POPULATION_ATTRIBUTE_CODE
  );

  const tenantsToRevoke = tenantsWithAttribute.filter((tenant) => {
    const istatRemoteId = tenant.data.remoteIds?.find(
      (r) => r.origin === ISTAT_CERTIFIER_ORIGIN
    )?.value;

    return !istatRemoteId || !populationByMunicipality.has(istatRemoteId);
  });

  if (tenantsToRevoke.length === 0) {
    logger.info("No municipalities to revoke.");
    return;
  }

  logger.info(
    `Found ${tenantsToRevoke.length} municipalities to revoke. Processing in chunks...`
  );

  const chunks = sliceIntoChunks<WithMetadata<Tenant>>(
    tenantsToRevoke,
    config.csvChunkSize
  );

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (tenant) => {
        const tenantData = tenant.data;
        logger.info(`Revoking ${tenantData.id}`);
        try {
          const token = await refreshableToken.get();
          const context: InteropContext = {
            correlationId,
            bearerToken: token.serialized,
          };

          const metadata =
            await tenantProcess.internalRevokeCertifiedDiscreteAttribute(
              tenantData.externalId.origin,
              tenantData.externalId.value,
              ISTAT_CERTIFIER_ORIGIN,
              ISTAT_POPULATION_ATTRIBUTE_CODE,
              context,
              logger
            );

          if (metadata) {
            await waitForReadModelMetadataVersion(
              () => readModel.getTenantByIdWithMetadata(tenantData.id),
              metadata.version,
              pollingConfig
            );
          }
          stats.revoked++;
        } catch (error) {
          logger.error(
            `Error revoking attribute for tenant - ${tenantData.id}: ${error}`
          );
          stats.errors++;
        }
      })
    );
  }
}

export async function ensureAttributeExists(
  readmodel: ReadModelServiceSQL,
  attributeProcess: AttributeProcessService,
  refreshableToken: RefreshableInteropToken,
  correlationId: CorrelationId,
  logger: Logger,
  pollingConfig: PollingConfig
): Promise<void> {
  let attr = await readmodel.getAttributeByExternalId(
    ISTAT_CERTIFIER_ORIGIN,
    ISTAT_POPULATION_ATTRIBUTE_CODE
  );

  if (attr) {
    logger.info(`Attribute ${ISTAT_POPULATION_ATTRIBUTE_CODE} already exists.`);
    return;
  }

  logger.info(`Creating attribute ${ISTAT_POPULATION_ATTRIBUTE_CODE}...`);
  const token = await refreshableToken.get();
  const context: InteropContext = {
    correlationId,
    bearerToken: token.serialized,
  };

  await attributeProcess.createInternalCertifiedDiscreteAttribute(
    ISTAT_CERTIFIER_ORIGIN,
    ISTAT_POPULATION_ATTRIBUTE_CODE,
    "Popolazione Residente",
    "Attributo certificato discreto indicante la popolazione comunale",
    context
  );

  logger.info("Polling Read Model for new attribute...");
  for (let i = 0; i < pollingConfig.defaultPollingMaxRetries; i++) {
    attr = await readmodel.getAttributeByExternalId(
      ISTAT_CERTIFIER_ORIGIN,
      ISTAT_POPULATION_ATTRIBUTE_CODE
    );

    if (attr) {
      logger.info(`Attribute found after ${i + 1} retries.`);
      return;
    }

    logger.info(`Retry ${i + 1}/${pollingConfig.defaultPollingMaxRetries}...`);
    await delay(pollingConfig.defaultPollingRetryDelay);
  }

  throw new Error(
    `Timeout: Attribute ${ISTAT_POPULATION_ATTRIBUTE_CODE} not found after polling.`
  );
}
