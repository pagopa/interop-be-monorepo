/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { inject } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import {
  attributeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAttribute,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import {
  Attribute,
  Tenant,
  TenantAttribute,
  unsafeBrandId,
} from "pagopa-interop-models";
import { readModelQueriesBuilderSQL } from "../src/service/readmodelQueriesServiceSQL.js";
import { SftpConfig } from "../src/config/sftpConfig.js";
import { InteropContext } from "../src/model/interopContextModel.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);

export const readModelQueries = readModelQueriesBuilderSQL(
  readModelDB,
  tenantReadModelServiceSQL,
  attributeReadModelServiceSQL
);

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await upsertAttribute(readModelDB, attribute, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export const sftpConfigTest: SftpConfig = {
  host: "host",
  port: 1,
  username: "user",
  password: "password",
  fileNamePrefix: "test",
  folderPath: "/",
  forceFileName: "test-file.csv",
};

export const CSV_HEADER =
  "codiceFiscaleGestore,denominazioneGestore,PEC,codiceIPA,ANAC_incaricato,ANAC_abilitato,ANAC_in_convalida";

const csvFileContent = `${CSV_HEADER}
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,FALSE,FALSE,FALSE`;

export const ATTRIBUTE_ANAC_ASSIGNED_ID =
  "b1d64ee0-fda9-48e2-84f8-1b62f1292b47";
export const ATTRIBUTE_ANAC_ENABLED_ID = "dc77c852-7635-4522-bc1c-e431c5d68b55";
export const ATTRIBUTE_ANAC_IN_VALIDATION_ID =
  "97dec753-8a6e-4a25-aa02-95ac8602b364";

export const ANAC_CERTIFIER_ID = "ANAC";
export const ANAC_TENANT_ID = "69e2865e-65ab-4e48-a638-2037a9ee2ee7";

export const downloadCSVMockGenerator =
  (csvContent: string) => (): Promise<string> =>
    Promise.resolve(csvContent);
export const downloadCSVMock = downloadCSVMockGenerator(csvFileContent);

export const internalAssignCertifiedAttributeMock = (
  _tenantOrigin: string,
  _tenantExternalId: string,
  _attributeOrigin: string,
  _attributeExternalId: string,
  _context: InteropContext
): Promise<{ version: number } | undefined> => Promise.resolve({ version: 1 });
export const internalRevokeCertifiedAttributeMock = (
  _tenantOrigin: string,
  _tenantExternalId: string,
  _attributeOrigin: string,
  _attributeExternalId: string,
  _context: InteropContext
): Promise<{ version: number } | undefined> => Promise.resolve({ version: 1 });

export const persistentTenant: Tenant = {
  id: unsafeBrandId("091fbea1-0c8e-411b-988f-5098b6a33ba7"),
  externalId: { origin: "tenantOrigin", value: "tenantValue" },
  attributes: [],
  features: [],
  name: "tenantName",
  createdAt: new Date(),
  mails: [],
};

export const persistentAttribute: Attribute = {
  id: unsafeBrandId("7a04c906-1525-4c68-8a5b-d740d77d9c80"),
  origin: "attributeOrigin",
  code: "attributeCode",
  name: "attributeName",
  kind: "Certified",
  creationTime: new Date(),
  description: "attributeDescription",
};

export const persistentTenantAttribute: TenantAttribute = {
  id: unsafeBrandId("7a04c906-1525-4c68-8a5b-d740d77d9c80"),
  type: "PersistentCertifiedAttribute",
  assignmentTimestamp: new Date(),
};

export const buildAnacCertifierTenant = (): Tenant => ({
  ...persistentTenant,
  id: unsafeBrandId(ANAC_TENANT_ID),
  name: "ANAC certifier tenant",
  features: [{ type: "PersistentCertifier", certifierId: ANAC_CERTIFIER_ID }],
});

export const buildAnacAttribute = (id: string, code: string): Attribute => ({
  ...persistentAttribute,
  id: unsafeBrandId(id),
  origin: ANAC_CERTIFIER_ID,
  code,
  name: code,
});
