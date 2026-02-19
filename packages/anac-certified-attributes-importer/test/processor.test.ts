/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { afterEach, beforeAll, describe, expect, it, vi, vitest } from "vitest";
import {
  InteropInternalToken,
  InteropTokenGenerator,
  RefreshableInteropToken,
  genericLogger,
} from "pagopa-interop-commons";
import { generateId, Tenant, unsafeBrandId } from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { TenantProcessService } from "../src/service/tenantProcessService.js";
import { SftpClient } from "../src/service/sftpService.js";
import { readModelQueriesBuilderSQL } from "../src/service/readmodelQueriesServiceSQL.js";
import { importAttributes } from "../src/service/processor.js";
import { config } from "../src/config/config.js";
import {
  ATTRIBUTE_ANAC_ASSIGNED_ID,
  ATTRIBUTE_ANAC_ENABLED_ID,
  ATTRIBUTE_ANAC_IN_VALIDATION_ID,
  downloadCSVMock,
  downloadCSVMockGenerator,
  getAttributeByExternalIdMock,
  getNonPATenantsMock,
  getPATenantsMock,
  getTenantByIdMock,
  getTenantByIdWithMetadataMock,
  getTenantByIdMockGenerator,
  getTenantsMockGenerator,
  getTenantsWithAttributesMock,
  internalAssignCertifiedAttributeMock,
  internalRevokeCertifiedAttributeMock,
  persistentTenant,
  persistentTenantAttribute,
  sftpConfigTest,
} from "./helpers.js";

describe("ANAC Certified Attributes Importer", () => {
  const tokenGeneratorMock = {} as InteropTokenGenerator;
  const refreshableTokenMock = new RefreshableInteropToken(tokenGeneratorMock);
  const tenantProcessMock = new TenantProcessService("url");
  const sftpClientMock = new SftpClient(sftpConfigTest);

  const db = makeDrizzleConnection(config);
  const tenantReadModelService = tenantReadModelServiceBuilder(db);
  const attributeReadModelService = attributeReadModelServiceBuilder(db);
  const readModelQueriesMock = readModelQueriesBuilderSQL(
    db,
    tenantReadModelService,
    attributeReadModelService
  );

  const interopInternalToken: InteropInternalToken = {
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
      role: "internal",
    },
    serialized: "the-token",
  };
  const generateInternalTokenMock = (): Promise<InteropInternalToken> =>
    Promise.resolve(interopInternalToken);

  const run = () =>
    importAttributes(
      sftpClientMock,
      readModelQueriesMock,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      {
        defaultPollingMaxRetries: 1,
        defaultPollingRetryDelay: 1,
      },
      "anac-tenant-id",
      genericLogger,
      generateId()
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

  const getPATenantsSpy = vi
    .spyOn(readModelQueriesMock, "getPATenants")
    .mockImplementation(getPATenantsMock);
  const getNonPATenantsSpy = vi
    .spyOn(readModelQueriesMock, "getNonPATenants")
    .mockImplementation(getNonPATenantsMock);
  const getTenantByIdSpy = vi
    .spyOn(readModelQueriesMock, "getTenantById")
    .mockImplementation((id) => getTenantByIdMock(unsafeBrandId(id)));
  const getTenantByIdWithMetadataSpy = vi
    .spyOn(readModelQueriesMock, "getTenantByIdWithMetadata")
    .mockImplementation((id) =>
      getTenantByIdWithMetadataMock(unsafeBrandId(id))
    );
  const getAttributeByExternalIdSpy = vi
    .spyOn(readModelQueriesMock, "getAttributeByExternalId")
    .mockImplementation(getAttributeByExternalIdMock);
  const getTenantsWithAttributesSpy = vi
    .spyOn(readModelQueriesMock, "getTenantsWithAttributes")
    .mockImplementation(getTenantsWithAttributesMock);

  beforeAll(() => {
    vitest.clearAllMocks();
  });

  afterEach(() => {
    vitest.clearAllMocks();
  });

  it("should succeed", async () => {
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(downloadCSVMock);

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

  it("should fail if polling max retries are reached after assign", async () => {
    const csvFileContent = `codiceFiscaleGestore,denominazioneGestore,PEC,codiceIPA,ANAC_incaricato,ANAC_abilitato,ANAC_in_convalida
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,FALSE,TRUE,FALSE`;

    const readModelTenants: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IPA", value: "ipa_code_123" },
        attributes: [],
      },
    ];

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    vi.spyOn(sftpClientMock, "downloadCSV").mockImplementation(localDownloadCSVMock);

    vi.spyOn(readModelQueriesMock, "getPATenants").mockImplementation(
      getTenantsMockGenerator((_) => readModelTenants)
    );

    internalAssignCertifiedAttributeSpy.mockResolvedValueOnce(5);

    await expect(
      importAttributes(
        sftpClientMock,
        readModelQueriesMock,
        tenantProcessMock,
        refreshableTokenMock,
        10,
        {
          defaultPollingMaxRetries: 1,
          defaultPollingRetryDelay: 1,
        },
        "anac-tenant-id",
        genericLogger,
        generateId()
      )
    ).rejects.toThrowError();

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(getTenantByIdWithMetadataSpy).toBeCalled();
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

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    const getPATenantsMock = getTenantsMockGenerator((_) => readModelTenants);
    const getPATenantsSpy = vi
      .spyOn(readModelQueriesMock, "getPATenants")
      .mockImplementation(getPATenantsMock);

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

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    const getPATenantsMock = getTenantsMockGenerator((_) => readModelTenants);
    const getPATenantsSpy = vi
      .spyOn(readModelQueriesMock, "getPATenants")
      .mockImplementation(getPATenantsMock);

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

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    const getPATenantsMock = getTenantsMockGenerator((_) => readModelTenants);
    const getPATenantsSpy = vi
      .spyOn(readModelQueriesMock, "getPATenants")
      .mockImplementation(getPATenantsMock);

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

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    const getPATenantsSpy = vi
      .spyOn(readModelQueriesMock, "getPATenants")
      .mockImplementationOnce(getTenantsMockGenerator((_) => readModelTenants))
      .mockImplementation(getTenantsMockGenerator((_) => []));

    await importAttributes(
      sftpClientMock,
      readModelQueriesMock,
      tenantProcessMock,
      refreshableTokenMock,
      1,
      {
        defaultPollingMaxRetries: 1,
        defaultPollingRetryDelay: 1,
      },
      "anac-tenant-id",
      genericLogger,
      generateId()
    );

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getTenantByIdWithMetadataSpy).toBeCalled();
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

    const getPATenantsMock = getTenantsMockGenerator((_) => readModelTenants);
    const getPATenantsSpy = vi
      .spyOn(readModelQueriesMock, "getPATenants")
      .mockImplementation(getPATenantsMock);

    const getTenantsWithAttributesMock = getTenantsMockGenerator(
      (_) => readModelTenants
    );
    const getTenantsWithAttributesSpy = vi
      .spyOn(readModelQueriesMock, "getTenantsWithAttributes")
      .mockImplementationOnce(getTenantsWithAttributesMock);

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

  it("should succeed, case insensivity for IPA code", async () => {
    const csvFileContent = `codiceFiscaleGestore,denominazioneGestore,PEC,codiceIPA,ANAC_incaricato,ANAC_abilitato,ANAC_in_convalida
0123456789,Org name in IPA,gsp1@pec.it,ipa_CODE_123,TRUE,TRUE,TRUE`;

    const readModelTenants: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IPA", value: "ipa_code_123" },
        attributes: [],
      },
    ];

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    const getPATenantsMock = getTenantsMockGenerator((_) => readModelTenants);
    const getPATenantsSpy = vi
      .spyOn(readModelQueriesMock, "getPATenants")
      .mockImplementation(getPATenantsMock);

    await run();

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(3);

    expect(getPATenantsSpy).toBeCalledTimes(1);
    expect(getNonPATenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(3);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(3);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed, unassigning existing attributes with case insensivity for IPA code", async () => {
    const csvFileContent = `codiceFiscaleGestore,denominazioneGestore,PEC,codiceIPA,ANAC_incaricato,ANAC_abilitato,ANAC_in_convalida
0123456789,Org name in IPA,gsp1@pec.it,ipa_CODE_123,TRUE,TRUE,FALSE`;

    const readModelTenants: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IPA", value: "ipa_code_123" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_ANAC_IN_VALIDATION_ID),
          },
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

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    const getPATenantsMock = getTenantsMockGenerator((_) => readModelTenants);
    const getPATenantsSpy = vi
      .spyOn(readModelQueriesMock, "getPATenants")
      .mockImplementation(getPATenantsMock);

    await run();

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(3);

    expect(getPATenantsSpy).toBeCalledTimes(1);
    expect(getNonPATenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
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

    const getTenantByIdMock = getTenantByIdMockGenerator((tenantId) => ({
      ...persistentTenant,
      id: tenantId,
      features: [],
    }));
    getTenantByIdSpy.mockImplementationOnce((id) =>
      getTenantByIdMock(unsafeBrandId(id))
    );

    await expect(() => run()).rejects.toThrowError(
      "Tenant with id anac-tenant-id is not a certifier"
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

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(localDownloadCSVMock);

    const getPATenantsMock = getTenantsMockGenerator((_) => readModelTenants);
    const getPATenantsSpy = vi
      .spyOn(readModelQueriesMock, "getPATenants")
      .mockImplementation(getPATenantsMock);

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
