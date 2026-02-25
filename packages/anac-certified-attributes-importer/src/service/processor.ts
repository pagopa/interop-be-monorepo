/* eslint-disable max-params */
import { parse } from "csv/sync";
import {
  Logger,
  RefreshableInteropToken,
  waitForReadModelMetadataVersion,
  zipBy,
} from "pagopa-interop-commons";
import { TenantFeatureCertifier, CorrelationId } from "pagopa-interop-models";
import {
  AnacAttributes,
  AttributeIdentifiers,
  BatchParseResult,
} from "../model/processorModel.js";
import { CsvRow, NonPaRow, PaRow } from "../model/csvRowModel.js";
import { InteropContext } from "../model/interopContextModel.js";
import { AnacReadModelTenant } from "../model/tenant.js";
import { TenantProcessService } from "./tenantProcessService.js";
import { SftpClient } from "./sftpService.js";
import { ReadModelQueriesSQL } from "./readmodelQueriesServiceSQL.js";

export const ANAC_ENABLED_CODE = "anac_abilitato";
export const ANAC_ASSIGNED_CODE = "anac_incaricato";
export const ANAC_IN_VALIDATION_CODE = "anac_in_convalida";

type PollingConfig = {
  defaultPollingMaxRetries: number;
  defaultPollingRetryDelay: number;
};

export async function importAttributes(
  sftpClient: SftpClient,
  readModel: ReadModelQueriesSQL,
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  recordsBatchSize: number,
  pollingConfig: PollingConfig,
  anacTenantId: string,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  logger.info("ANAC Certified attributes importer started");

  const fileContent = await sftpClient.downloadCSV(logger);

  const attributes: AnacAttributes = await getAttributesIdentifiers(
    readModel,
    anacTenantId
  );

  const allOrgsInFile = await processFileContent(
    readModel,
    tenantProcess,
    refreshableToken,
    fileContent,
    attributes,
    recordsBatchSize,
    pollingConfig,
    logger,
    correlationId
  );

  if (allOrgsInFile.length === 0) {
    throw new Error("File does not contain valid assignments");
  }

  await unassignMissingOrgsAttributes(
    readModel,
    tenantProcess,
    refreshableToken,
    allOrgsInFile,
    attributes,
    pollingConfig,
    logger,
    correlationId
  );

  logger.info("ANAC Certified attributes importer completed");
}

async function processFileContent(
  readModel: ReadModelQueriesSQL,
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  fileContent: string,
  attributes: AnacAttributes,
  recordsBatchSize: number,
  pollingConfig: PollingConfig,
  logger: Logger,
  correlationId: CorrelationId
): Promise<string[]> {
  const batchSize = recordsBatchSize;

  const processTenants = prepareTenantsProcessor(
    tenantProcess,
    refreshableToken,
    attributes,
    readModel,
    pollingConfig,
    logger,
    correlationId
  );

  // eslint-disable-next-line functional/no-let
  let scanComplete = false;
  // eslint-disable-next-line functional/no-let
  let fromLine = 1;
  // eslint-disable-next-line functional/no-let
  let allOrgsInFile: string[] = [];

  do {
    const batchResult: BatchParseResult = getBatch(
      fileContent,
      fromLine,
      batchSize,
      logger
    );

    const paOrgs: PaRow[] = batchResult.records
      .map((org: CsvRow) => {
        if ("codice_ipa" in org) {
          return {
            ...org,
            codice_ipa: org.codice_ipa.toLocaleLowerCase(),
          };
        } else {
          return null;
        }
      })
      .filter((r): r is PaRow => r !== null);

    const nonPaOrgs: NonPaRow[] = batchResult.records
      .map((org: CsvRow) => {
        if ("codice_ipa" in org) {
          return null;
        } else {
          return org;
        }
      })
      .filter((r): r is NonPaRow => r !== null);

    await processTenants(
      paOrgs,
      (org) => org.codice_ipa,
      (codes) => readModel.getPATenants(codes)
    );
    await processTenants(
      nonPaOrgs,
      (org) => org.cf_gestore,
      (codes) => readModel.getNonPATenants(codes)
    );

    allOrgsInFile = allOrgsInFile
      .concat(paOrgs.map((o) => o.codice_ipa))
      .concat(nonPaOrgs.map((o) => o.cf_gestore));

    fromLine = fromLine + batchSize;
    scanComplete = batchResult.processedRecordsCount === 0;
  } while (!scanComplete);

  return allOrgsInFile;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function unassignMissingOrgsAttributes(
  readModel: ReadModelQueriesSQL,
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  allOrgsInFile: string[],
  attributes: AnacAttributes,
  pollingConfig: PollingConfig,
  logger: Logger,
  correlationId: CorrelationId
) {
  logger.info("Revoking attributes for organizations not in file...");

  const tenantsWithAttribute = await readModel.getTenantsWithAttributes([
    attributes.anacAbilitato.id,
    attributes.anacInConvalida.id,
    attributes.anacIncaricato.id,
  ]);
  await Promise.all(
    tenantsWithAttribute
      .filter((tenant) => !allOrgsInFile.includes(tenant.externalId.value))
      .map(async (tenant) => {
        await unassignAttribute(
          tenantProcess,
          refreshableToken,
          tenant,
          attributes.anacAbilitato,
          readModel,
          pollingConfig,
          logger,
          correlationId
        );
        await unassignAttribute(
          tenantProcess,
          refreshableToken,
          tenant,
          attributes.anacInConvalida,
          readModel,
          pollingConfig,
          logger,
          correlationId
        );
        await unassignAttribute(
          tenantProcess,
          refreshableToken,
          tenant,
          attributes.anacIncaricato,
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
  anacTenantId: string
): Promise<AnacAttributes> {
  const anacTenant: AnacReadModelTenant = await readModel.getTenantById(
    anacTenantId
  );
  const certifier = anacTenant.features.find(
    (f): f is TenantFeatureCertifier => f.type === "PersistentCertifier"
  );

  if (!certifier) {
    throw Error(`Tenant with id ${anacTenantId} is not a certifier`);
  }

  const anacAbilitato = await readModel.getAttributeByExternalId(
    certifier.certifierId,
    ANAC_ENABLED_CODE
  );
  const anacIncaricato = await readModel.getAttributeByExternalId(
    certifier.certifierId,
    ANAC_ASSIGNED_CODE
  );
  const anacInConvalida = await readModel.getAttributeByExternalId(
    certifier.certifierId,
    ANAC_IN_VALIDATION_CODE
  );

  return {
    anacAbilitato: {
      id: anacAbilitato.id,
      externalId: {
        origin: anacAbilitato.origin || "",
        value: anacAbilitato.code || "",
      },
    },
    anacIncaricato: {
      id: anacIncaricato.id,
      externalId: {
        origin: anacIncaricato.origin || "",
        value: anacIncaricato.code || "",
      },
    },
    anacInConvalida: {
      id: anacInConvalida.id,
      externalId: {
        origin: anacInConvalida.origin || "",
        value: anacInConvalida.code || "",
      },
    },
  };
}

const prepareTenantsProcessor = (
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  attributes: AnacAttributes,
  readModel: ReadModelQueriesSQL,
  pollingConfig: PollingConfig,
  logger: Logger,
  correlationId: CorrelationId
) =>
  async function processTenants<T extends CsvRow>(
    orgs: T[],
    extractTenantCode: (org: T) => string,
    retrieveTenants: (codes: string[]) => Promise<AnacReadModelTenant[]>
  ): Promise<void> {
    if (orgs.length === 0) {
      return;
    }

    const codes = orgs.map(extractTenantCode);

    const tenants = await retrieveTenants(codes);

    const missingTenants = getMissingTenants(codes, tenants);

    if (missingTenants.length !== 0) {
      logger.warn(
        `Organizations in CSV not found in Tenants for codes: ${missingTenants}`
      );
    }

    await Promise.all(
      zipBy(
        orgs,
        tenants,
        extractTenantCode,
        (tenant) => tenant.externalId.value
      ).map(async ([org, tenant]) => {
        if (org.anac_abilitato) {
          await assignAttribute(
            tenantProcess,
            refreshableToken,
            tenant,
            attributes.anacAbilitato,
            readModel,
            pollingConfig,
            logger,
            correlationId
          );
        } else {
          await unassignAttribute(
            tenantProcess,
            refreshableToken,
            tenant,
            attributes.anacAbilitato,
            readModel,
            pollingConfig,
            logger,
            correlationId
          );
        }

        if (org.anac_in_convalida) {
          await assignAttribute(
            tenantProcess,
            refreshableToken,
            tenant,
            attributes.anacInConvalida,
            readModel,
            pollingConfig,
            logger,
            correlationId
          );
        } else {
          await unassignAttribute(
            tenantProcess,
            refreshableToken,
            tenant,
            attributes.anacInConvalida,
            readModel,
            pollingConfig,
            logger,
            correlationId
          );
        }

        if (org.anac_incaricato) {
          await assignAttribute(
            tenantProcess,
            refreshableToken,
            tenant,
            attributes.anacIncaricato,
            readModel,
            pollingConfig,
            logger,
            correlationId
          );
        } else {
          await unassignAttribute(
            tenantProcess,
            refreshableToken,
            tenant,
            attributes.anacIncaricato,
            readModel,
            pollingConfig,
            logger,
            correlationId
          );
        }
      })
    );
  };

async function assignAttribute(
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  tenant: AnacReadModelTenant,
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
    const metadataVersion =
      await tenantProcess.internalAssignCertifiedAttribute(
        tenant.externalId.origin,
        tenant.externalId.value,
        attribute.externalId.origin,
        attribute.externalId.value,
        context,
        logger
      );

    await waitForReadModelMetadataVersion(
      () => readModel.getTenantByIdWithMetadata(tenant.id),
      metadataVersion,
      `tenant ${tenant.id}`,
      logger,
      pollingConfig
    );
  }
}

async function unassignAttribute(
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  tenant: AnacReadModelTenant,
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

    await waitForReadModelMetadataVersion(
      () => readModel.getTenantByIdWithMetadata(tenant.id),
      metadataVersion,
      `tenant ${tenant.id}`,
      logger,
      pollingConfig
    );
  }
}

function tenantContainsAttribute(
  tenant: AnacReadModelTenant,
  attributeId: string
): boolean {
  return (
    tenant.attributes.find((attribute) => attribute.id === attributeId) !==
    undefined
  );
}

function getMissingTenants(
  expectedExternalId: string[],
  tenants: AnacReadModelTenant[]
): string[] {
  const existingSet = new Set(tenants.map((t) => t.externalId.value));

  return expectedExternalId.filter((v) => !existingSet.has(v));
}

function getBatch(
  fileContent: string,
  fromLine: number,
  batchSize: number,
  logger: Logger
): BatchParseResult {
  const rawRecords = parse(fileContent, {
    trim: true,
    columns: true,
    relax_quotes: true,
    from: fromLine,
    to: fromLine + batchSize - 1,
  }) as object[];

  const records: CsvRow[] = rawRecords
    .map((value, index) => {
      const result = CsvRow.safeParse(value);
      if (result.success) {
        return result.data;
      } else {
        logger.error(
          `Error parsing row ${fromLine + index}: ${JSON.stringify(
            result.error
          )}`
        );
        return null;
      }
    })
    .filter((r): r is CsvRow => r !== null);

  return {
    processedRecordsCount: rawRecords.length,
    records,
  };
}
