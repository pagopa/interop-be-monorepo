import { parse } from "csv";
import {
  Logger,
  RefreshableInteropToken,
  retry,
  waitForReadModelMetadataVersion,
} from "pagopa-interop-commons";
import { CorrelationId, Tenant, WithMetadata } from "pagopa-interop-models";
import { InteropContext } from "../model/interopContextModel.js";
import { JobStats } from "../model/istatModel.js";
import { TenantProcessService } from "./tenantProcessService.js";
import { IstatClient } from "./istatClient.js";
import { AttributeProcessService } from "./attributeProcessService.js";
import { ISTAT_ATTRIBUTE_SEED, SUMMARY_AGE_CODE } from "../config/constants.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";
import { Readable } from "stream";
import { isAxiosError } from "axios";

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
  csvChunkSize: number,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  logger.info("ISTAT Certified discrete attributes importer started");
  const stats: JobStats = {
    processed: 0,
    created: 0,
    updated: 0,
    revoked: 0,
    errors: 0,
  };

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
  const chunks = sliceIntoChunks(entries, csvChunkSize);

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

          try {
            await tenantProcess.internalAssignCertifiedDiscreteAttribute(
              ISTAT_ATTRIBUTE_SEED.origin,
              municipalityCode,
              ISTAT_ATTRIBUTE_SEED.origin,
              ISTAT_ATTRIBUTE_SEED.code,
              totalCount,
              context,
              logger
            );
            stats.created++;
          } catch (error) {
            console.log("ERROR", error);
            const isConflict =
              isAxiosError(error) && error.response?.status === 409;

            if (isConflict) {
              await tenantProcess.internalUpdateCertifiedDiscreteAttribute(
                ISTAT_ATTRIBUTE_SEED.origin,
                municipalityCode,
                ISTAT_ATTRIBUTE_SEED.origin,
                ISTAT_ATTRIBUTE_SEED.code,
                totalCount,
                context,
                logger
              );
              stats.updated++;
            } else {
              throw error;
            }
          }
        } catch (error) {
          logger.error(
            `Error processing municipality ${municipalityCode}: ${error}`
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
    csvChunkSize,
    stats,
    logger,
    correlationId
  );

  logger.info(
    `Process complete. Processed: ${stats.processed}, Success: ${stats.created}, Updated: ${stats.updated}, Revoked: ${stats.revoked}, Error: ${stats.errors}`
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
  csvChunkSize: number,
  stats: JobStats,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  const tenantsWithAttribute = await readModel.getTenantsWithDiscreteAttribute(
    ISTAT_ATTRIBUTE_SEED.origin,
    ISTAT_ATTRIBUTE_SEED.code
  );

  const tenantsToRevoke = tenantsWithAttribute.filter((tenant) => {
    const istatRemoteId = tenant.data.remoteIds?.find(
      (r) => r.origin === ISTAT_ATTRIBUTE_SEED.origin
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
    csvChunkSize
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
              ISTAT_ATTRIBUTE_SEED.origin,
              ISTAT_ATTRIBUTE_SEED.code,
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

async function ensureAttributeExists(
  readmodel: ReadModelServiceSQL,
  attributeProcess: AttributeProcessService,
  refreshableToken: RefreshableInteropToken,
  correlationId: CorrelationId,
  logger: Logger,
  pollingConfig: PollingConfig
): Promise<void> {
  let attr = await readmodel.getAttributeByExternalId(
    ISTAT_ATTRIBUTE_SEED.origin,
    ISTAT_ATTRIBUTE_SEED.code
  );

  if (attr) {
    logger.info(`Attribute ${ISTAT_ATTRIBUTE_SEED.code} already exists.`);
    return;
  }

  logger.info(`Creating attribute ${ISTAT_ATTRIBUTE_SEED.code}...`);
  const token = await refreshableToken.get();
  const context: InteropContext = {
    correlationId,
    bearerToken: token.serialized,
  };

  await attributeProcess.createInternalCertifiedDiscreteAttribute(
    ISTAT_ATTRIBUTE_SEED.origin,
    ISTAT_ATTRIBUTE_SEED.code,
    ISTAT_ATTRIBUTE_SEED.name,
    ISTAT_ATTRIBUTE_SEED.description,
    context
  );

  logger.info("Polling Read Model for new attribute...");
  attr = await retry(
    async () => {
      const a = await readmodel.getAttributeByExternalId(
        ISTAT_ATTRIBUTE_SEED.origin,
        ISTAT_ATTRIBUTE_SEED.code
      );
      if (!a) throw new Error("Attribute not found");
      return a;
    },
    {
      retries: pollingConfig.defaultPollingMaxRetries,
      delay: pollingConfig.defaultPollingRetryDelay,
    }
  );
  logger.info(`Attribute ${attr.data.id} found after polling.`);
}
