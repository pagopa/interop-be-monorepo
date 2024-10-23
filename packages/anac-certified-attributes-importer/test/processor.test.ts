/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  inject,
  it,
  vi,
  vitest,
} from "vitest";
import {
  InteropToken,
  InteropTokenGenerator,
  RefreshableInteropToken,
  genericLogger,
} from "pagopa-interop-commons";
import {
  Tenant,
  toReadModelAttribute,
  toReadModelTenant,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { TenantProcessService } from "../src/service/tenantProcessService.js";
import { SftpClient } from "../src/service/sftpService.js";
import { ReadModelQueries } from "../src/service/readmodelQueriesService.js";
import {
  ANAC_ASSIGNED_CODE,
  ANAC_ENABLED_CODE,
  ANAC_IN_VALIDATION_CODE,
  importAttributes,
} from "../src/service/processor.js";
import {
  ATTRIBUTE_ANAC_ASSIGNED_ID,
  ATTRIBUTE_ANAC_ENABLED_ID,
  ATTRIBUTE_ANAC_IN_VALIDATION_ID,
  downloadCSVMock,
  downloadCSVMockGenerator,
  getTenantsMockGenerator,
  internalAssignCertifiedAttributeMock,
  internalRevokeCertifiedAttributeMock,
  MOCK_ANAC_ID,
  persistentAttribute,
  persistentTenant,
  persistentTenantAttribute,
  sftpConfigTest,
} from "./helpers.js";

export const { cleanup, readModelRepository } = await setupTestContainersVitest(
  inject("readModelConfig")
);

describe("ANAC Certified Attributes Importer", () => {
  const tokenGeneratorMock = {} as InteropTokenGenerator;
  const refreshableTokenMock = new RefreshableInteropToken(tokenGeneratorMock);
  const tenantProcessMock = new TenantProcessService("url");
  const sftpClientMock = new SftpClient(sftpConfigTest);
  const readModelQueries = new ReadModelQueries(readModelRepository);

  const interopToken: InteropToken = {
    header: {
      alg: "algorithm",
      use: "use",
      typ: "type",
      kid: "key-id",
    },
    payload: {
      jti: "token-id",
      iss: "issuer",
      aud: ["audience1"],
      sub: "subject",
      iat: 0,
      nbf: 0,
      exp: 10,
      role: "role1",
    },
    serialized: "the-token",
  };
  const generateInternalTokenMock = (): Promise<InteropToken> =>
    Promise.resolve(interopToken);

  const run = () =>
    importAttributes(
      sftpClientMock,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      MOCK_ANAC_ID,
      genericLogger
    );

  const refreshableInternalTokenSpy = vi
    .spyOn(refreshableTokenMock, "get")
    .mockImplementation(generateInternalTokenMock);

  const internalAssignCertifiedAttributeSpy = vi
    .spyOn(tenantProcessMock, "internalAssignCertifiedAttribute")
    .mockImplementation(internalAssignCertifiedAttributeMock);
  const internalRevokeCertifiedAttributeSpy = vi
    .spyOn(tenantProcessMock, "internalRevokeCertifiedAttribute")
    .mockImplementation(internalRevokeCertifiedAttributeMock);

  const getPATenantsSpy = vi.spyOn(readModelQueries, "getPATenants");
  const getNonPATenantsSpy = vi.spyOn(readModelQueries, "getNonPATenants");
  const getTenantByIdSpy = vi.spyOn(readModelQueries, "getTenantById");
  const getAttributeByExternalIdSpy = vi.spyOn(
    readModelQueries,
    "getAttributeByExternalId"
  );
  const getTenantsWithAttributesSpy = vi.spyOn(
    readModelQueries,
    "getTenantsWithAttributes"
  );

  beforeAll(() => {
    vitest.clearAllMocks();
  });

  afterEach(async () => {
    vitest.clearAllMocks();
    await cleanup();
  });

  it("should succeed", async () => {
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(downloadCSVMock);

    await writeInitialData();
    await run();

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(3);

    expect(getPATenantsSpy).toBeCalledTimes(1);
    expect(getNonPATenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalled();
    expect(internalAssignCertifiedAttributeSpy).toBeCalled();
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed, assigning only missing attributes", async () => {
    const csvFileContent = `codiceFiscaleGestore,denominazioneGestore,PEC,codiceIPA,ANAC_incaricato,ANAC_abilitato,ANAC_in_convalida
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,TRUE,TRUE,TRUE`;

    const readModelTenants: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IPA", value: "ipa_code_123" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
          },
        ],
      },
    ];

    await writeInitialData();

    await Promise.all(
      readModelTenants.map((t) =>
        writeInReadmodel(toReadModelTenant(t), readModelRepository.tenants)
      )
    );

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    const getPATenantsSpy = vi.spyOn(readModelQueries, "getPATenants");

    await run();

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(3);

    expect(getPATenantsSpy).toBeCalledTimes(1);
    expect(getNonPATenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed, unassigning only existing attributes", async () => {
    const csvFileContent = `codiceFiscaleGestore,denominazioneGestore,PEC,codiceIPA,ANAC_incaricato,ANAC_abilitato,ANAC_in_convalida
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,FALSE,FALSE,FALSE`;

    const readModelTenants: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IPA", value: "ipa_code_123" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
          },
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ASSIGNED_ID),
          },
        ],
      },
    ];

    await writeInitialData();
    await Promise.all(
      readModelTenants.map((t) =>
        writeInReadmodel(toReadModelTenant(t), readModelRepository.tenants)
      )
    );

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    const getPATenantsSpy = vi.spyOn(readModelQueries, "getPATenants");

    await run();

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(3);

    expect(getPATenantsSpy).toBeCalledTimes(1);
    expect(getNonPATenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(2);
  });

  it("should succeed, only for tenants that exist on read model ", async () => {
    const csvFileContent = `codiceFiscaleGestore,denominazioneGestore,PEC,codiceIPA,ANAC_incaricato,ANAC_abilitato,ANAC_in_convalida
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,TRUE,TRUE,TRUE
9876543210,Org name not in Tenants,gsp2@pec.it,ipa_code_456,TRUE,TRUE,TRUE`;

    const readModelTenants: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IPA", value: "ipa_code_123" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
          },
        ],
      },
    ];

    await writeInitialData();
    await Promise.all(
      readModelTenants.map((t) =>
        writeInReadmodel(toReadModelTenant(t), readModelRepository.tenants)
      )
    );

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    const getPATenantsSpy = vi.spyOn(readModelQueries, "getPATenants");

    await run();

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(3);

    expect(getPATenantsSpy).toBeCalledTimes(1);
    expect(getNonPATenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed with more than one batch", async () => {
    const csvFileContent = `codiceFiscaleGestore,denominazioneGestore,PEC,codiceIPA,ANAC_incaricato,ANAC_abilitato,ANAC_in_convalida
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,TRUE,TRUE,TRUE
9876543210,Org name not in Tenants,gsp2@pec.it,ipa_code_456,TRUE,TRUE,TRUE
9876543299,Org name not in Tenants,gsp3@pec.it,ipa_code_789,TRUE,TRUE,TRUE`;

    const readModelTenants: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IPA", value: "ipa_code_123" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
          },
        ],
      },
    ];

    await writeInitialData();
    await Promise.all(
      readModelTenants.map((t) =>
        writeInReadmodel(toReadModelTenant(t), readModelRepository.tenants)
      )
    );

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    const getPATenantsSpy = vi
      .spyOn(readModelQueries, "getPATenants")
      .mockImplementationOnce(getTenantsMockGenerator((_) => readModelTenants))
      .mockImplementation(getTenantsMockGenerator((_) => []));

    await importAttributes(
      sftpClientMock,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      1,
      MOCK_ANAC_ID,
      genericLogger
    );

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(3);

    expect(getPATenantsSpy).toBeCalledTimes(3);
    expect(getNonPATenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed, unassign attributes for tenants not in the file", async () => {
    const csvFileContent = `codiceFiscaleGestore,denominazioneGestore,PEC,codiceIPA,ANAC_incaricato,ANAC_abilitato,ANAC_in_convalida
0123456781,Org name in IPA,gsp1@pec.it,ipa_code_1,TRUE,TRUE,TRUE`;

    const readModelTenants: Tenant[] = [
      {
        // Tenant with attributes that should be kept
        ...persistentTenant,
        externalId: { origin: "IPA", value: "ipa_code_1" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
          },
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ASSIGNED_ID),
          },
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_IN_VALIDATION_ID),
          },
        ],
      },
      {
        // IPA Tenant with ANAC_ABILITATO attribute that should be removed
        ...persistentTenant,
        externalId: { origin: "IPA", value: "ipa_code_2" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
          },
        ],
      },
      {
        // IPA Tenant with ANAC_INCARICATO attribute that should be removed
        ...persistentTenant,
        externalId: { origin: "IPA", value: "ipa_code_3" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ASSIGNED_ID),
          },
        ],
      },
      {
        // IPA Tenant with ANAC_IN_CONVALIDA attribute that should be removed
        ...persistentTenant,
        externalId: { origin: "IPA", value: "ipa_code_4" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_IN_VALIDATION_ID),
          },
        ],
      },
      {
        // IPA Tenant with multiple attributes that should be removed
        ...persistentTenant,
        externalId: { origin: "IPA", value: "ipa_code_5" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
          },
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ASSIGNED_ID),
          },
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_IN_VALIDATION_ID),
          },
        ],
      },
      {
        // Private Tenant with multiple attributes that should be removed
        ...persistentTenant,
        externalId: { origin: "ANAC", value: "0123456786" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
          },
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ASSIGNED_ID),
          },
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_IN_VALIDATION_ID),
          },
        ],
      },
    ];

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    const getPATenantsSpy = vi.spyOn(readModelQueries, "getPATenants");
    const getTenantsWithAttributesSpy = vi.spyOn(
      readModelQueries,
      "getTenantsWithAttributes"
    );

    await writeInitialData();
    await Promise.all(
      readModelTenants.map((t) =>
        writeInReadmodel(toReadModelTenant(t), readModelRepository.tenants)
      )
    );

    await run();

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(3);

    expect(getPATenantsSpy).toBeCalledTimes(1);
    expect(getNonPATenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(9);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(9);
  });

  it("should fail on CSV retrieve error", async () => {
    const localDownloadCSVMock = (): Promise<string> =>
      Promise.reject(new Error("CSV Retrieve error"));
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    await expect(() => run()).rejects.toThrowError("CSV Retrieve error");

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(0);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(0);

    expect(getPATenantsSpy).toBeCalledTimes(0);
    expect(getNonPATenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should fail if the tenant is not configured as certifier", async () => {
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(downloadCSVMock);

    await writeInReadmodel(
      toReadModelTenant({
        ...persistentTenant,
        id: MOCK_ANAC_ID,
        features: [],
      }),
      readModelRepository.tenants
    );

    await expect(() => run()).rejects.toThrowError(
      `Tenant with id ${MOCK_ANAC_ID} is not a certifier`
    );

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(0);

    expect(getPATenantsSpy).toBeCalledTimes(0);
    expect(getNonPATenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should skip CSV file rows with unexpected schema", async () => {
    const csvFileContent = `codiceFiscaleGestore,denominazioneGestore,PEC,codiceIPA,ANAC_incaricato,ANAC_abilitato,ANAC_in_convalida
    ,Wrong format row,gsp1@pec.it,ipa_code_123,TRUE,TRUE,
    ,Wrong "quotes" row,gsp1@pec.it,ipa_code_123,TRUE,TRUE,TRUE
    0123456789,"Org name, in IPA",gsp1@pec.it,ipa_code_123,TRUE,TRUE,TRUE`;

    const readModelTenants: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IPA", value: "ipa_code_123" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
          },
        ],
      },
    ];

    await writeInitialData();
    await Promise.all(
      readModelTenants.map((t) =>
        writeInReadmodel(toReadModelTenant(t), readModelRepository.tenants)
      )
    );

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    const getPATenantsSpy = vi.spyOn(readModelQueries, "getPATenants");

    await run();

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(3);

    expect(getPATenantsSpy).toBeCalledTimes(1);
    expect(getNonPATenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });
});

function writeInitialData() {
  return Promise.all([
    writeInReadmodel(
      toReadModelTenant({
        id: MOCK_ANAC_ID,
        externalId: { origin: "IVASS", value: "12345678901" },
        attributes: [],
        createdAt: new Date(),
        features: [{ type: "PersistentCertifier", certifierId: "IVASS" }],
        mails: [],
        name: "tenantName",
      }),
      readModelRepository.tenants
    ),

    writeInReadmodel(
      toReadModelAttribute({
        ...persistentAttribute,
        id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
        origin: "IVASS",
        code: ANAC_ENABLED_CODE,
      }),
      readModelRepository.attributes
    ),
    writeInReadmodel(
      toReadModelAttribute({
        ...persistentAttribute,
        id: unsafeBrandId(ATTRIBUTE_ANAC_ASSIGNED_ID),
        origin: "IVASS",
        code: ANAC_ASSIGNED_CODE,
      }),
      readModelRepository.attributes
    ),
    writeInReadmodel(
      toReadModelAttribute({
        ...persistentAttribute,
        id: unsafeBrandId(ATTRIBUTE_ANAC_IN_VALIDATION_ID),
        origin: "IVASS",
        code: ANAC_IN_VALIDATION_CODE,
      }),
      readModelRepository.attributes
    ),
  ]);
}
