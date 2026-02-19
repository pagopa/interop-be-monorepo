/* eslint-disable max-params */
import {
  Logger,
  RefreshableInteropToken,
  createPollingByCondition,
} from "pagopa-interop-commons";
import { CorrelationId, TenantFeatureCertifier } from "pagopa-interop-models";
import { parse } from "csv/sync";
import {
  AttributeIdentifiers,
  BatchParseResult,
  IvassAttributes,
} from "../model/processorModel.js";
import { IVASS_INSURANCES_ATTRIBUTE_CODE } from "../config/constants.js";
import { CsvRow, RawCsvRow } from "../model/csvRowModel.js";
import { InteropContext } from "../model/interopContextModel.js";
import { IvassReadModelTenant } from "../model/tenant.js";
import { TenantProcessService } from "./tenantProcessService.js";
import { ReadModelQueriesSQL } from "./readModelQueriesServiceSQL.js";

type PollingConfig = {
  defaultPollingMaxRetries: number;
  defaultPollingRetryDelay: number;
};

export async function importAttributes(
  csvDownloader: () => Promise<string>,
  readModel: ReadModelQueriesSQL,
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  recordsBatchSize: number,
  pollingConfig: PollingConfig,
  ivassTenantId: string,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  logger.info("IVASS Certified attributes importer started");

  const fileContent = await csvDownloader();

  const attributes: IvassAttributes = await getAttributesIdentifiers(
    readModel,
    ivassTenantId
  );

  const allOrgsInFile = await assignAttributes(
    readModel,
    tenantProcess,
    refreshableToken,
    attributes,
    fileContent,
    recordsBatchSize,
    pollingConfig,
    logger,
    correlationId
  );

  await unassignAttributes(
    readModel,
    tenantProcess,
    refreshableToken,
    allOrgsInFile,
    attributes,
    pollingConfig,
    logger,
    correlationId
  );

  logger.info("IVASS Certified attributes importer completed");
}

async function assignAttributes(
  readModel: ReadModelQueriesSQL,
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  attributes: IvassAttributes,
  fileContent: string,
  batchSize: number,
  pollingConfig: PollingConfig,
  logger: Logger,
  correlationId: CorrelationId
): Promise<string[]> {
  // eslint-disable-next-line functional/no-let
  let scanComplete = false;
  // eslint-disable-next-line functional/no-let
  let fromLine = 1;
  // eslint-disable-next-line functional/no-let
  let allOrgsInFile: string[] = [];

  const now = Date.now();

  logger.info("Assigning attributes...");

  do {
    const batchResult: BatchParseResult = getBatch(
      fileContent,
      fromLine,
      batchSize,
      logger
    );

    const assignments = batchResult.records.filter((record) =>
      isAttributeAssigned(record, now)
    );

    if (assignments.length > 0) {
      const externalId = assignments.map(
        (org) => org.CODICE_FISCALE || org.CODICE_IVASS
      );

      const tenants = await readModel.getIVASSTenants(externalId);

      await Promise.all(
        tenants.map(async (tenant) => {
          await assignAttribute(
            tenantProcess,
            refreshableToken,
            tenant,
            attributes.ivassInsurances,
            readModel,
            pollingConfig,
            logger,
            correlationId
          );
        })
      );

      allOrgsInFile = allOrgsInFile.concat(
        assignments.map((a) => a.CODICE_FISCALE || a.CODICE_IVASS)
      );
    }

    fromLine = fromLine + batchSize;
    scanComplete = batchResult.processedRecordsCount === 0;
  } while (!scanComplete);

  logger.info("Attributes assignment completed");

  if (allOrgsInFile.length === 0) {
    throw new Error("File does not contain valid assignments");
  }

  return allOrgsInFile;
}

async function unassignAttributes(
  readModel: ReadModelQueriesSQL,
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  allOrgsInFile: string[],
  attributes: IvassAttributes,
  pollingConfig: PollingConfig,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  logger.info("Revoking attributes...");

  const tenantsWithAttribute = await readModel.getTenantsWithAttributes([
    attributes.ivassInsurances.id,
  ]);
  await Promise.all(
    tenantsWithAttribute
      .filter((tenant) => !allOrgsInFile.includes(tenant.externalId.value))
      .map(async (tenant) => {
        await unassignAttribute(
          tenantProcess,
          refreshableToken,
          tenant,
          attributes.ivassInsurances,
          readModel,
          pollingConfig,
          logger,
          correlationId
        );
      })
  );

  logger.info("Attributes revocation completed");
}

async function getAttributesIdentifiers(
  readModel: ReadModelQueriesSQL,
  ivassTenantId: string
): Promise<IvassAttributes> {
  const ivassTenant: IvassReadModelTenant = await readModel.getTenantById(
    ivassTenantId
  );
  const certifier = ivassTenant.features.find(
    (f) => f.type === "PersistentCertifier"
  );

  if (!certifier) {
    throw Error(`Tenant with id ${ivassTenantId} is not a certifier`);
  }

  const ivassInsurances = await readModel.getAttributeByExternalId(
    (certifier as TenantFeatureCertifier).certifierId,
    IVASS_INSURANCES_ATTRIBUTE_CODE
  );

  return {
    ivassInsurances: {
      id: ivassInsurances.id,
      externalId: {
        origin: ivassInsurances.origin || "",
        value: ivassInsurances.code || "",
      },
    },
  };
}

const isAttributeAssigned = (org: CsvRow, now: number): boolean =>
  org.DATA_ISCRIZIONE_ALBO_ELENCO.getTime() < now &&
  org.DATA_CANCELLAZIONE_ALBO_ELENCO.getTime() > now;

async function assignAttribute(
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  tenant: IvassReadModelTenant,
  attribute: AttributeIdentifiers,
  readModel: ReadModelQueriesSQL,
  pollingConfig: PollingConfig,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  if (!tenantContainsAttribute(tenant, attribute.id)) {
    logger.info(`Assigning attribute ${attribute.id} to tenant ${tenant.id}`);

    const token = await refreshableToken.get();
    const context: InteropContext = {
      correlationId,
      bearerToken: token.serialized,
    };
    const metadataVersion = await tenantProcess.internalAssignCertifiedAttribute(
      tenant.externalId.origin,
      tenant.externalId.value,
      attribute.externalId.origin,
      attribute.externalId.value,
      context,
      logger
    );

    await waitForTenantReadModelVersion(
      readModel,
      tenant.id,
      metadataVersion,
      pollingConfig,
      logger
    );
  }
}

async function unassignAttribute(
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  tenant: IvassReadModelTenant,
  attribute: AttributeIdentifiers,
  readModel: ReadModelQueriesSQL,
  pollingConfig: PollingConfig,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  if (tenantContainsAttribute(tenant, attribute.id)) {
    logger.info(`Revoking attribute ${attribute.id} to tenant ${tenant.id}`);

    const token = await refreshableToken.get();
    const context: InteropContext = {
      correlationId,
      bearerToken: token.serialized,
    };
    const metadataVersion =
      await tenantProcess.internalRevokeCertifiedAttribute(
        tenant.externalId.origin,
        tenant.externalId.value,
        attribute.externalId.origin,
        attribute.externalId.value,
        context,
        logger
      );

    await waitForTenantReadModelVersion(
      readModel,
      tenant.id,
      metadataVersion,
      pollingConfig,
      logger
    );
  }
}

async function waitForTenantReadModelVersion(
  readModel: ReadModelQueriesSQL,
  tenantId: string,
  targetVersion: number | undefined,
  pollingConfig: PollingConfig,
  logger: Logger
): Promise<void> {
  if (targetVersion === undefined) {
    logger.warn(`Missing metadata version for tenant ${tenantId}. Skipping polling.`);
    return;
  }

  const pollTenantByVersion = createPollingByCondition(
    () => readModel.getTenantByIdWithMetadata(tenantId),
    {
      defaultPollingMaxRetries: pollingConfig.defaultPollingMaxRetries,
      defaultPollingRetryDelay: pollingConfig.defaultPollingRetryDelay,
    }
  );

  await pollTenantByVersion({
    condition: (tenantWithMetadata) =>
      tenantWithMetadata !== undefined &&
      tenantWithMetadata.metadata.version >= targetVersion,
  });
}

function tenantContainsAttribute(
  tenant: IvassReadModelTenant,
  attributeId: string
): boolean {
  return (
    tenant.attributes.find((attribute) => attribute.id === attributeId) !==
    undefined
  );
}

function getBatch(
  fileContent: string,
  fromLine: number,
  batchSize: number,
  logger: Logger
): BatchParseResult {
  const rawRecords = parse(fileContent.trim(), {
    ltrim: true,
    columns: true,
    relax_quotes: true,
    from: fromLine,
    to: fromLine + batchSize - 1,
    delimiter: ";",
  }) as object[];

  const records: CsvRow[] = rawRecords
    .map((value, index) => {
      const result = RawCsvRow.safeParse(value);
      if (result.success) {
        return result.data;
      } else {
        logger.error(
          `Error parsing row ${fromLine + index}. Row: ${JSON.stringify(
            value
          )}: Error: ${JSON.stringify(result.error)}`
        );
        return null;
      }
    })
    .map((r): CsvRow | null => {
      if (!r) {
        return null;
      } else {
        const row: CsvRow = {
          CODICE_IVASS: r.CODICE_IVASS,
          DATA_ISCRIZIONE_ALBO_ELENCO: r.DATA_ISCRIZIONE_ALBO_ELENCO,
          DATA_CANCELLAZIONE_ALBO_ELENCO: r.DATA_CANCELLAZIONE_ALBO_ELENCO,
          CODICE_FISCALE: r.CODICE_FISCALE,
        };
        return row;
      }
    })
    .filter((r): r is CsvRow => r !== null);

  return {
    processedRecordsCount: rawRecords.length,
    records,
  };
}
