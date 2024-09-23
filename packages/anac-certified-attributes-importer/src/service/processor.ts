/* eslint-disable max-params */
import crypto from "crypto";
import { parse } from "csv/sync";
import { Logger, RefreshableInteropToken, zipBy } from "pagopa-interop-commons";
import { Tenant } from "pagopa-interop-models";
import {
  AnacAttributes,
  AttributeIdentifiers,
  BatchParseResult,
} from "../model/processorModel.js";
import { CsvRow, NonPaRow, PaRow } from "../model/csvRowModel.js";
import { InteropContext } from "../model/interopContextModel.js";
import { TenantProcessService } from "./tenantProcessService.js";
import { ReadModelQueries } from "./readmodelQueriesService.js";
import { SftpClient } from "./sftpService.js";

export const ANAC_ENABLED_CODE = "anac_abilitato";
export const ANAC_ASSIGNED_CODE = "anac_incaricato";
export const ANAC_IN_VALIDATION_CODE = "anac_in_convalida";

export async function importAttributes(
  sftpClient: SftpClient,
  readModel: ReadModelQueries,
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  recordsBatchSize: number,
  anacTenantId: string,
  logger: Logger
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
    logger
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
    logger
  );

  logger.info("ANAC Certified attributes importer completed");
}

async function processFileContent(
  readModel: ReadModelQueries,
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  fileContent: string,
  attributes: AnacAttributes,
  recordsBatchSize: number,
  logger: Logger
): Promise<string[]> {
  const batchSize = recordsBatchSize;

  const processTenants = prepareTenantsProcessor(
    tenantProcess,
    refreshableToken,
    attributes,
    logger
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
          return org;
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
  readModel: ReadModelQueries,
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  allOrgsInFile: string[],
  attributes: AnacAttributes,
  logger: Logger
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
          logger
        );
        await unassignAttribute(
          tenantProcess,
          refreshableToken,
          tenant,
          attributes.anacInConvalida,
          logger
        );
        await unassignAttribute(
          tenantProcess,
          refreshableToken,
          tenant,
          attributes.anacIncaricato,
          logger
        );
      })
  );

  logger.info("Attributes revocation completed");
}

async function getAttributesIdentifiers(
  readModel: ReadModelQueries,
  anacTenantId: string
): Promise<AnacAttributes> {
  const anacTenant: Tenant = await readModel.getTenantById(anacTenantId);
  const certifier = anacTenant.features.find(
    (f) => f.type === "PersistentCertifier"
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
  logger: Logger
) =>
  async function processTenants<T extends CsvRow>(
    orgs: T[],
    extractTenantCode: (org: T) => string,
    retrieveTenants: (codes: string[]) => Promise<Tenant[]>
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
            logger
          );
        } else {
          await unassignAttribute(
            tenantProcess,
            refreshableToken,
            tenant,
            attributes.anacAbilitato,
            logger
          );
        }

        if (org.anac_in_convalida) {
          await assignAttribute(
            tenantProcess,
            refreshableToken,
            tenant,
            attributes.anacInConvalida,
            logger
          );
        } else {
          await unassignAttribute(
            tenantProcess,
            refreshableToken,
            tenant,
            attributes.anacInConvalida,
            logger
          );
        }

        if (org.anac_incaricato) {
          await assignAttribute(
            tenantProcess,
            refreshableToken,
            tenant,
            attributes.anacIncaricato,
            logger
          );
        } else {
          await unassignAttribute(
            tenantProcess,
            refreshableToken,
            tenant,
            attributes.anacIncaricato,
            logger
          );
        }
      })
    );
  };

async function assignAttribute(
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  tenant: Tenant,
  attribute: AttributeIdentifiers,
  logger: Logger
): Promise<void> {
  if (!tenantContainsAttribute(tenant, attribute.id)) {
    logger.info(`Assigning attribute ${attribute.id} to tenant ${tenant.id}`);

    const token = await refreshableToken.get();
    const context: InteropContext = {
      correlationId: crypto.randomUUID(),
      bearerToken: token.serialized,
    };
    await tenantProcess.internalAssignCertifiedAttribute(
      tenant.externalId.origin,
      tenant.externalId.value,
      attribute.externalId.origin,
      attribute.externalId.value,
      context,
      logger
    );
  }
}

async function unassignAttribute(
  tenantProcess: TenantProcessService,
  refreshableToken: RefreshableInteropToken,
  tenant: Tenant,
  attribute: AttributeIdentifiers,
  logger: Logger
): Promise<void> {
  if (tenantContainsAttribute(tenant, attribute.id)) {
    logger.info(`Revoking attribute ${attribute.id} to tenant ${tenant.id}`);

    const token = await refreshableToken.get();
    const context: InteropContext = {
      correlationId: crypto.randomUUID(),
      bearerToken: token.serialized,
    };
    await tenantProcess.internalRevokeCertifiedAttribute(
      tenant.externalId.origin,
      tenant.externalId.value,
      attribute.externalId.origin,
      attribute.externalId.value,
      context,
      logger
    );
  }
}

function tenantContainsAttribute(tenant: Tenant, attributeId: string): boolean {
  return (
    tenant.attributes.find((attribute) => attribute.id === attributeId) !==
    undefined
  );
}

function getMissingTenants(
  expectedExternalId: string[],
  tenants: Tenant[]
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
