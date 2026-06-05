import { parse } from "csv/sync";
import {
  Logger,
  RefreshableInteropToken,
  delay,
  waitForReadModelMetadataVersion,
} from "pagopa-interop-commons";
import { CorrelationId } from "pagopa-interop-models";
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

type PollingConfig = {
  defaultPollingMaxRetries: number;
  defaultPollingRetryDelay: number;
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
  const stats: JobStats = { processed: 0, created: 0, errors: 0 };

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

  for (const [
    municipalityCode,
    totalCount,
  ] of populationByMunicipality.entries()) {
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
  const rawRecords = parse(fileContent, {
    trim: true,
    columns: true,
    delimiter: ";",
    relax_quotes: true,
  });
  const populationMap = new Map<string, number>();

  for (const row of rawRecords) {
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

  await Promise.all(
    tenantsWithAttribute.map(async (tenant) => {
      const tenantData = tenant.data;
      const istatRemoteId = tenantData.remoteIds?.find(
        (r) => r.origin === ISTAT_CERTIFIER_ORIGIN
      )?.value;

      if (!istatRemoteId || !populationByMunicipality.has(istatRemoteId)) {
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
          stats.created++;
        } catch (error) {
          logger.error(
            `Error revoking attribute for tenant - ${tenantData.id}: ${error}`
          );
          stats.errors++;
        }
      }
    })
  );
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
