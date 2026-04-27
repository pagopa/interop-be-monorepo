/* eslint-disable prettier/prettier */
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
import { readModelQueriesBuilderSQL } from "../src/service/readModelQueriesServiceSQL.js";
import {
  IVASS_INSURANCES_ATTRIBUTE_CODE,
  IVASS_ORIGIN_NAME,
} from "../src/config/constants.js";
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

export const CSV_HEADER =
  "CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE";

const csvFileContent = `${CSV_HEADER}
D0001;2020-12-02;9999-12-31;Org1;0000012345678901`;

export const ATTRIBUTE_IVASS_INSURANCES_ID =
  "b1d64ee0-fda9-48e2-84f8-1b62f1292b47";

export const IVASS_TENANT_ID = "69e2865e-65ab-4e48-a638-2037a9ee2ee8";

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
  createdAt: new Date(),
  mails: [],
  name: "tenantName",
};

const persistentAttribute: Attribute = {
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

export const buildIvassCertifierTenant = (): Tenant => ({
  ...persistentTenant,
  id: unsafeBrandId(IVASS_TENANT_ID),
  name: "IVASS certifier tenant",
  features: [
    { type: "PersistentCertifier", certifierId: IVASS_ORIGIN_NAME },
  ],
});

export const buildIvassInsurancesAttribute = (): Attribute => ({
  ...persistentAttribute,
  id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
  origin: IVASS_ORIGIN_NAME,
  code: IVASS_INSURANCES_ATTRIBUTE_CODE,
  name: IVASS_INSURANCES_ATTRIBUTE_CODE,
});
