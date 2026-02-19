/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { randomUUID } from "crypto";
import { it, afterEach, beforeAll, describe, expect, vi, vitest } from "vitest";
import {
  InteropInternalToken,
  InteropTokenGenerator,
  RefreshableInteropToken,
  genericLogger,
} from "pagopa-interop-commons";
import { generateId, Tenant, unsafeBrandId } from "pagopa-interop-models";
import {
  tenantReadModelServiceBuilder,
  attributeReadModelServiceBuilder,
  makeDrizzleConnection,
} from "pagopa-interop-readmodel";
import { TenantProcessService } from "../src/service/tenantProcessService.js";
import { importAttributes } from "../src/service/processor.js";
import { readModelQueriesBuilderSQL } from "../src/service/readModelQueriesServiceSQL.js";
import { config } from "../src/config/config.js";
import {
  ATTRIBUTE_IVASS_INSURANCES_ID,
  downloadCSVMock,
  downloadCSVMockGenerator,
  getAttributeByExternalIdMock,
  getIVASSTenantsMock,
  getTenantByIdMock,
  getTenantByIdWithMetadataMock,
  getTenantByIdMockGenerator,
  getTenantsMockGenerator,
  getTenantsWithAttributesMock,
  internalAssignCertifiedAttributeMock,
  internalRevokeCertifiedAttributeMock,
  persistentTenant,
  persistentTenantAttribute,
} from "./helpers.js";

describe("IVASS Certified Attributes Importer", () => {
  const tokenGeneratorMock = {} as InteropTokenGenerator;
  const refreshableTokenMock = new RefreshableInteropToken(tokenGeneratorMock);
  const tenantProcessMock = new TenantProcessService("url");
  const csvDownloaderMock = downloadCSVMock;

  const db = makeDrizzleConnection(config);
  const tenantReadModelService = tenantReadModelServiceBuilder(db);
  const attributeReadModelService = attributeReadModelServiceBuilder(db);
  const readModelQueriesMock = readModelQueriesBuilderSQL(
    db,
    tenantReadModelService,
    attributeReadModelService
  );

  const run = () =>
    importAttributes(
      csvDownloaderMock,
      readModelQueriesMock,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      {
        defaultPollingMaxRetries: 1,
        defaultPollingRetryDelay: 1,
      },
      "ivass-tenant-id",
      genericLogger,
      generateId()
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

  const refreshableInternalTokenSpy = vi
    .spyOn(refreshableTokenMock, "get")
    .mockImplementation(generateInternalTokenMock);

  const internalAssignCertifiedAttributeSpy = vi
    .spyOn(tenantProcessMock, "internalAssignCertifiedAttribute")
    .mockImplementation(internalAssignCertifiedAttributeMock);
  const internalRevokeCertifiedAttributeSpy = vi
    .spyOn(tenantProcessMock, "internalRevokeCertifiedAttribute")
    .mockImplementation(internalRevokeCertifiedAttributeMock);

  const getIVASSTenantsSpy = vi
    .spyOn(readModelQueriesMock, "getIVASSTenants")
    .mockImplementation(getIVASSTenantsMock);
  const getTenantsWithAttributesSpy = vi
    .spyOn(readModelQueriesMock, "getTenantsWithAttributes")
    .mockImplementation(getTenantsWithAttributesMock);
  const getTenantByIdSpy = vi
    .spyOn(readModelQueriesMock, "getTenantById")
    .mockImplementation((id) => getTenantByIdMock(unsafeBrandId(id)));
  const getTenantByIdWithMetadataSpy = vi
    .spyOn(readModelQueriesMock, "getTenantByIdWithMetadata")
    .mockImplementation((id) => getTenantByIdWithMetadataMock(unsafeBrandId(id)));
  const getAttributeByExternalIdSpy = vi
    .spyOn(readModelQueriesMock, "getAttributeByExternalId")
    .mockImplementation(getAttributeByExternalIdMock);

  beforeAll(() => {
    vitest.clearAllMocks();
  });

  afterEach(() => {
    vitest.clearAllMocks();
  });

  it("should succeed", async () => {
    await run();

    expect(downloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getTenantByIdWithMetadataSpy).toBeCalled();
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalled();
    expect(internalAssignCertifiedAttributeSpy).toBeCalled();
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should fail if polling max retries are reached after assign", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
    D0001;2020-12-02;9999-12-31;Org1;0000012345678901`;

    const readModelTenants: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IVASS", value: "12345678901" },
        attributes: [],
      },
    ];

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    vi.spyOn(readModelQueriesMock, "getIVASSTenants").mockImplementation(
      getTenantsMockGenerator((_) => readModelTenants)
    );

    internalAssignCertifiedAttributeSpy.mockResolvedValueOnce(5);

    await expect(
      importAttributes(
        localDownloadCSVMock,
        readModelQueriesMock,
        tenantProcessMock,
        refreshableTokenMock,
        10,
        {
          defaultPollingMaxRetries: 1,
          defaultPollingRetryDelay: 1,
        },
        "ivass-tenant-id",
        genericLogger,
        generateId()
      )
    ).rejects.toThrowError();

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(getTenantByIdWithMetadataSpy).toBeCalled();
  });

  it("should succeed with fields starting with quotes", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
    D0001;2020-12-02;9999-12-31;"DE ROTTERDAM" BUILDING, 29TH FLOOR, EAST TOWER, WILHELMINAKADE 149A (3072 AP)  ROTTERDAM PAESI BASSI;0000012345678901
    `;

    const readModelTenants: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IVASS", value: "12345678901" },
        attributes: [],
      },
    ];

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsMock = getTenantsMockGenerator(
      (_) => readModelTenants
    );
    const getIVASSTenantsSpy = vi
      .spyOn(readModelQueriesMock, "getIVASSTenants")
      .mockImplementation(getIVASSTenantsMock);

    await importAttributes(
      localDownloadCSVMock,
      readModelQueriesMock,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      {
        defaultPollingMaxRetries: 1,
        defaultPollingRetryDelay: 1,
      },
      "ivass-tenant-id",
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toHaveBeenCalledWith(
      readModelTenants.map((t) => t.externalId.value)
    );
    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed, assigning only missing attributes", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
    D0001;2020-12-02;9999-12-31;Org1;0000012345678901
    D0002;2020-06-10;9999-12-31;Org2;0000012345678902
    D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    const readModelTenants: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IVASS", value: "12345678901" },
        attributes: [
          {
            ...persistentTenantAttribute,
            id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
          },
        ],
      },
      {
        ...persistentTenant,
        externalId: { origin: "IVASS", value: "12345678902" },
        attributes: [{ ...persistentTenantAttribute }],
      },
      {
        ...persistentTenant,
        externalId: { origin: "IVASS", value: "12345678903" },
        attributes: [],
      },
    ];

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsMock = getTenantsMockGenerator(
      (_) => readModelTenants
    );
    const getIVASSTenantsSpy = vi
      .spyOn(readModelQueriesMock, "getIVASSTenants")
      .mockImplementation(getIVASSTenantsMock);

    await importAttributes(
      localDownloadCSVMock,
      readModelQueriesMock,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      {
        defaultPollingMaxRetries: 1,
        defaultPollingRetryDelay: 1,
      },
      "ivass-tenant-id",
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toHaveBeenCalledWith(
      readModelTenants.map((t) => t.externalId.value)
    );
    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed, unassigning expired organizations ", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
    D0001;2020-12-02;2021-12-31;Org1;0000012345678901
    D0002;2100-06-10;9999-12-31;Org2;0000012345678902
    D0003;2000-06-10;9999-12-31;Org3;0000012345678903`;

    const tenant1: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678901" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };
    const tenant2: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678902" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };
    const tenant3: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678903" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsMock = getTenantsMockGenerator((_) => [tenant3]);
    const getIVASSTenantsSpy = vi
      .spyOn(readModelQueriesMock, "getIVASSTenants")
      .mockImplementation(getIVASSTenantsMock);

    const getTenantsWithAttributesMock = getTenantsMockGenerator((_) => [
      tenant1,
      tenant2,
      tenant3,
    ]);
    const getTenantsWithAttributesSpy = vi
      .spyOn(readModelQueriesMock, "getTenantsWithAttributes")
      .mockImplementation(getTenantsWithAttributesMock);

    await importAttributes(
      localDownloadCSVMock,
      readModelQueriesMock,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      {
        defaultPollingMaxRetries: 1,
        defaultPollingRetryDelay: 1,
      },
      "ivass-tenant-id",
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toHaveBeenCalledWith([tenant3.externalId.value]);
    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(2);
  });

  it("should succeed, unassigning only existing attributes", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
    D0001;2020-12-02;2021-12-31;Org1;0000012345678901
    D0002;2020-06-10;2021-12-31;Org2;0000012345678902
    D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    const tenant3: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678901" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsMock = getTenantsMockGenerator((_) => []);
    const getIVASSTenantsSpy = vi
      .spyOn(readModelQueriesMock, "getIVASSTenants")
      .mockImplementation(getIVASSTenantsMock);

    const getTenantsWithAttributesMock = getTenantsMockGenerator((_) => [
      tenant3,
    ]);
    const getTenantsWithAttributesSpy = vi
      .spyOn(readModelQueriesMock, "getTenantsWithAttributes")
      .mockImplementation(getTenantsWithAttributesMock);

    await importAttributes(
      localDownloadCSVMock,
      readModelQueriesMock,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      {
        defaultPollingMaxRetries: 1,
        defaultPollingRetryDelay: 1,
      },
      "ivass-tenant-id",
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toHaveBeenCalledWith(["12345678903"]);
    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
  });

  it("should succeed, only for tenants that exist on read model ", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
    D0001;2020-12-02;9999-12-31;Org1;0000012345678901
    D0002;2020-06-10;2021-12-31;Org2;0000012345678902
    D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    const tenant3: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678903" },
      attributes: [{ ...persistentTenantAttribute }],
    };

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsMock = getTenantsMockGenerator((_) => [tenant3]);
    const getIVASSTenantsSpy = vi
      .spyOn(readModelQueriesMock, "getIVASSTenants")
      .mockImplementation(getIVASSTenantsMock);

    const getTenantsWithAttributesSpy = vi
      .spyOn(readModelQueriesMock, "getTenantsWithAttributes")
      .mockImplementation(getTenantsWithAttributesMock);

    await importAttributes(
      localDownloadCSVMock,
      readModelQueriesMock,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      {
        defaultPollingMaxRetries: 1,
        defaultPollingRetryDelay: 1,
      },
      "ivass-tenant-id",
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toHaveBeenCalledWith([
      "12345678901",
      tenant3.externalId.value,
    ]);
    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed with more than one batch", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
      D0001;2020-12-02;9999-12-31;Org1;0000012345678901
      D0002;2020-06-10;2021-12-31;Org2;0000012345678902
      D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    const readModelTenantsBatch1: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IVASS", value: "12345678901" },
        attributes: [{ ...persistentTenantAttribute }],
      },
    ];

    const readModelTenantsBatch2: Tenant[] = [
      {
        ...persistentTenant,
        externalId: { origin: "IVASS", value: "12345678903" },
        attributes: [{ ...persistentTenantAttribute }],
      },
    ];

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsSpy = vi
      .spyOn(readModelQueriesMock, "getIVASSTenants")
      .mockImplementationOnce(
        getTenantsMockGenerator((_) => readModelTenantsBatch1)
      )
      .mockImplementation(
        getTenantsMockGenerator((_) => readModelTenantsBatch2)
      );

    const getTenantsWithAttributesSpy = vi
      .spyOn(readModelQueriesMock, "getTenantsWithAttributes")
      .mockImplementation(getTenantsWithAttributesMock);

    await importAttributes(
      localDownloadCSVMock,
      readModelQueriesMock,
      tenantProcessMock,
      refreshableTokenMock,
      1,
      {
        defaultPollingMaxRetries: 1,
        defaultPollingRetryDelay: 1,
      },
      "ivass-tenant-id",
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toBeCalledTimes(2);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should fail on CSV retrieve error", async () => {
    const localDownloadCSVMock = vi
      .fn()
      .mockImplementation(
        (): Promise<string> => Promise.reject(new Error("CSV Retrieve error"))
      );

    await expect(() =>
      importAttributes(
        localDownloadCSVMock,
        readModelQueriesMock,
        tenantProcessMock,
        refreshableTokenMock,
        1,
        {
          defaultPollingMaxRetries: 1,
          defaultPollingRetryDelay: 1,
        },
        "ivass-tenant-id",
        genericLogger,
        generateId()
      )
    ).rejects.toThrowError("CSV Retrieve error");

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(0);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(0);

    expect(getIVASSTenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should fail if the tenant is not configured as certifier", async () => {
    const getTenantByIdMock = getTenantByIdMockGenerator((tenantId) => ({
      ...persistentTenant,
      id: tenantId,
      features: [],
    }));
    getTenantByIdSpy.mockImplementationOnce((id) =>
      getTenantByIdMock(unsafeBrandId(id))
    );

    await expect(() => run()).rejects.toThrowError(
      "Tenant with id ivass-tenant-id is not a certifier"
    );

    expect(downloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(0);

    expect(getIVASSTenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should skip CSV file rows with unexpected schema", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
      ;Unexpected value;;Org1;0000012345678901
      D0002;2020-06-10;2021-12-31;Org2;0000012345678902
      D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    const tenant2: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678902" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };
    const tenant3: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678903" },
      attributes: [{ ...persistentTenantAttribute }],
    };

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsMock = getTenantsMockGenerator((_) => [tenant3]);
    const getIVASSTenantsSpy = vi
      .spyOn(readModelQueriesMock, "getIVASSTenants")
      .mockImplementation(getIVASSTenantsMock);

    const getTenantsWithAttributesMock = getTenantsMockGenerator((_) => [
      tenant2,
    ]);
    const getTenantsWithAttributesSpy = vi
      .spyOn(readModelQueriesMock, "getTenantsWithAttributes")
      .mockImplementation(getTenantsWithAttributesMock);

    await importAttributes(
      localDownloadCSVMock,
      readModelQueriesMock,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      {
        defaultPollingMaxRetries: 1,
        defaultPollingRetryDelay: 1,
      },
      "ivass-tenant-id",
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
  });

  it("should succeed with missing Tax Code", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
      D0001;2020-12-02;9999-12-31;Org1;
      D0002;2020-06-10;9999-12-31;Org2;0000012345678902
      D0003;2019-07-19;9999-12-31;Org3;`;

    const tenant1: Tenant = {
      ...persistentTenant,
      id: unsafeBrandId(randomUUID()),
      externalId: { origin: "IVASS", value: "D0001" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };
    const tenant2: Tenant = {
      ...persistentTenant,
      id: unsafeBrandId(randomUUID()),
      externalId: { origin: "IVASS", value: "D0003" },
      attributes: [],
    };

    const tenant3: Tenant = {
      ...persistentTenant,
      id: unsafeBrandId(randomUUID()),
      externalId: { origin: "IVASS", value: "D0005" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };

    const readModelTenants: Tenant[] = [tenant1, tenant2, tenant3];

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsMock = getTenantsMockGenerator(
      (_) => readModelTenants
    );
    const getIVASSTenantsSpy = vi
      .spyOn(readModelQueriesMock, "getIVASSTenants")
      .mockImplementation(getIVASSTenantsMock);

    const getTenantsWithAttributesMock = getTenantsMockGenerator((_) => [
      tenant1,
      tenant3,
    ]);
    const getTenantsWithAttributesSpy = vi
      .spyOn(readModelQueriesMock, "getTenantsWithAttributes")
      .mockImplementation(getTenantsWithAttributesMock);

    await importAttributes(
      localDownloadCSVMock,
      readModelQueriesMock,
      tenantProcessMock,
      refreshableTokenMock,
      10,
      {
        defaultPollingMaxRetries: 1,
        defaultPollingRetryDelay: 1,
      },
      "ivass-tenant-id",
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(2);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalAssignCertifiedAttributeSpy.mock.calls[0][0]).toEqual(
      "IVASS"
    );
    expect(internalAssignCertifiedAttributeSpy.mock.calls[0][1]).toEqual(
      "D0003"
    );
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalRevokeCertifiedAttributeSpy.mock.calls[0][0]).toEqual(
      "IVASS"
    );
    expect(internalRevokeCertifiedAttributeSpy.mock.calls[0][1]).toEqual(
      "D0005"
    );
  });

  it("should unassign attribute for tenants not in the file", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
      D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    const tenant1: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678901" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };

    const tenant3: Tenant = {
      ...persistentTenant,
      externalId: { origin: "IVASS", value: "12345678903" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    };

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsMock = getTenantsMockGenerator((_) => [tenant3]);
    const getIVASSTenantsSpy = vi
      .spyOn(readModelQueriesMock, "getIVASSTenants")
      .mockImplementation(getIVASSTenantsMock);

    const getTenantsWithAttributesMock = getTenantsMockGenerator((_) => [
      tenant1,
    ]);
    const getTenantsWithAttributesSpy = vi
      .spyOn(readModelQueriesMock, "getTenantsWithAttributes")
      .mockImplementation(getTenantsWithAttributesMock);

    await importAttributes(
      localDownloadCSVMock,
      readModelQueriesMock,
      tenantProcessMock,
      refreshableTokenMock,
      1,
      {
        defaultPollingMaxRetries: 1,
        defaultPollingRetryDelay: 1,
      },
      "ivass-tenant-id",
      genericLogger,
      generateId()
    );

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toBeCalledTimes(1);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(1);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(1);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
  });

  it("should fail if the file does not contain records", async () => {
    const csvFileContent = `CODICE_IVASS;DATA_ISCRIZIONE_ALBO_ELENCO;DATA_CANCELLAZIONE_ALBO_ELENCO;DENOMINAZIONE_IMPRESA;CODICE_FISCALE
      `;

    const localDownloadCSVMock = downloadCSVMockGenerator(csvFileContent);

    const getIVASSTenantsSpy = vi
      .spyOn(readModelQueriesMock, "getIVASSTenants")
      .mockImplementation(getIVASSTenantsMock);
    const getTenantsWithAttributesSpy = vi
      .spyOn(readModelQueriesMock, "getTenantsWithAttributes")
      .mockImplementation(getTenantsWithAttributesMock);

    await expect(() =>
      importAttributes(
        localDownloadCSVMock,
        readModelQueriesMock,
        tenantProcessMock,
        refreshableTokenMock,
        10,
        {
          defaultPollingMaxRetries: 1,
          defaultPollingRetryDelay: 1,
        },
        "ivass-tenant-id",
        genericLogger,
        generateId()
      )
    ).rejects.toThrowError("File does not contain valid assignments");

    expect(localDownloadCSVMock).toBeCalledTimes(1);
    expect(getTenantByIdSpy).toBeCalledTimes(1);
    expect(getAttributeByExternalIdSpy).toBeCalledTimes(1);

    expect(getIVASSTenantsSpy).toBeCalledTimes(0);
    expect(getTenantsWithAttributesSpy).toBeCalledTimes(0);

    expect(refreshableInternalTokenSpy).toBeCalledTimes(0);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });
});
