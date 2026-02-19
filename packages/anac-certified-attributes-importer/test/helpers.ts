/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  Attribute,
  Tenant,
  TenantAttribute,
  TenantId,
  WithMetadata,
  unsafeBrandId,
} from "pagopa-interop-models";
import { SftpConfig } from "../src/config/sftpConfig.js";
import { InteropContext } from "../src/model/interopContextModel.js";
import {
  ANAC_ASSIGNED_CODE,
  ANAC_ENABLED_CODE,
  ANAC_IN_VALIDATION_CODE,
} from "../src/service/processor.js";

export const sftpConfigTest: SftpConfig = {
  host: "host",
  port: 1,
  username: "user",
  password: "password",
  fileNamePrefix: "test",
  folderPath: "/",
  forceFileName: "test-file.csv",
};

const csvFileContent = `codiceFiscaleGestore,denominazioneGestore,PEC,codiceIPA,ANAC_incaricato,ANAC_abilitato,ANAC_in_convalida
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,TRUE,FALSE,TRUE
0011223344,E-Procurement 1,eprocurement1@pec.it,,TRUE,TRUE,FALSE
0011223344,"E-Procurement 2 con , virgola nel nome",eprocurement1@pec.it,,TRUE,TRUE,FALSE`;

export const ATTRIBUTE_ANAC_ASSIGNED_ID =
  "b1d64ee0-fda9-48e2-84f8-1b62f1292b47";
export const ATTRIBUTE_ANAC_ENABLED_ID = "dc77c852-7635-4522-bc1c-e431c5d68b55";
export const ATTRIBUTE_ANAC_IN_VALIDATION_ID =
  "97dec753-8a6e-4a25-aa02-95ac8602b364";

export const downloadCSVMockGenerator =
  (csvContent: string) => (): Promise<string> =>
    Promise.resolve(csvContent);
export const getTenantsMockGenerator =
  (f: (codes: string[]) => Tenant[]) =>
  (codes: string[]): Promise<Tenant[]> =>
    Promise.resolve(f(codes));
export const getTenantByIdMockGenerator =
  (f: (tenantId: TenantId) => Tenant) =>
  (tenantId: TenantId): Promise<Tenant> =>
    Promise.resolve(f(tenantId));
export const getTenantByIdWithMetadataMockGenerator =
  (f: (tenantId: TenantId) => Tenant) =>
  (tenantId: TenantId): Promise<WithMetadata<Tenant>> =>
    Promise.resolve({
      data: f(tenantId),
      metadata: { version: 1 },
    } as WithMetadata<Tenant>);

export const downloadCSVMock = downloadCSVMockGenerator(csvFileContent);

export const internalAssignCertifiedAttributeMock = (
  _tenantOrigin: string,
  _tenantExternalId: string,
  _attributeOrigin: string,
  _attributeExternalId: string,
  _context: InteropContext
): Promise<number | undefined> => Promise.resolve(1);
export const internalRevokeCertifiedAttributeMock = (
  _tenantOrigin: string,
  _tenantExternalId: string,
  _attributeOrigin: string,
  _attributeExternalId: string,
  _context: InteropContext
): Promise<number | undefined> => Promise.resolve(1);

export const getPATenantsMock = getTenantsMockGenerator((ipaCodes) =>
  ipaCodes.map((c) => ({
    ...persistentTenant,
    externalId: { origin: "tenantOrigin", value: c },
  }))
);
export const getNonPATenantsMock = getTenantsMockGenerator((taxCodes) =>
  taxCodes.map((c) => ({
    ...persistentTenant,
    externalId: { origin: "tenantOrigin", value: c },
  }))
);
const buildAnacTenantById = (tenantId: string): Tenant => ({
  ...persistentTenant,
  id: tenantId,
  features: [{ type: "PersistentCertifier", certifierId: "ANAC" }],
});
export const getTenantByIdMock =
  getTenantByIdMockGenerator(buildAnacTenantById);
export const getTenantByIdWithMetadataMock =
  getTenantByIdWithMetadataMockGenerator(buildAnacTenantById);
export const getAttributeByExternalIdMock = (
  origin: string,
  code: string
): Promise<Attribute> => {
  switch (code) {
    case ANAC_ENABLED_CODE:
      return Promise.resolve({
        ...persistentAttribute,
        id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
        origin,
        code,
      });
    case ANAC_IN_VALIDATION_CODE:
      return Promise.resolve({
        ...persistentAttribute,
        id: unsafeBrandId(ATTRIBUTE_ANAC_IN_VALIDATION_ID),
        origin,
        code,
      });
    case ANAC_ASSIGNED_CODE:
      return Promise.resolve({
        ...persistentAttribute,
        id: unsafeBrandId(ATTRIBUTE_ANAC_ASSIGNED_ID),
        origin,
        code,
      });
    default:
      return Promise.reject(new Error("Unexpected attribute code"));
  }
};
export const getTenantsWithAttributesMock = (_: string[]) =>
  Promise.resolve([]);

export const persistentTenant: Tenant = {
  id: unsafeBrandId("091fbea1-0c8e-411b-988f-5098b6a33ba7"),
  externalId: { origin: "tenantOrigin", value: "tenantValue" },
  attributes: [],
  features: [],
  name: "tenantName",
  createdAt: new Date(),
  mails: [],
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
