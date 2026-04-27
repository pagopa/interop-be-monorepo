/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { randomUUID } from "crypto";
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  InteropInternalToken,
  InteropTokenGenerator,
  RefreshableInteropToken,
  genericLogger,
} from "pagopa-interop-commons";
import {
  Tenant,
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { TenantProcessService } from "../src/service/tenantProcessService.js";
import { importAttributes } from "../src/service/processor.js";
import { IVASS_ORIGIN_NAME } from "../src/config/constants.js";
import {
  ATTRIBUTE_IVASS_INSURANCES_ID,
  CSV_HEADER,
  IVASS_TENANT_ID,
  addOneAttribute,
  addOneTenant,
  buildIvassCertifierTenant,
  buildIvassInsurancesAttribute,
  cleanup,
  downloadCSVMock,
  downloadCSVMockGenerator,
  internalAssignCertifiedAttributeMock,
  internalRevokeCertifiedAttributeMock,
  persistentTenant,
  persistentTenantAttribute,
  readModelQueries,
} from "./helpers.js";

const { waitForReadModelMetadataVersionMock } = vi.hoisted(() => ({
  waitForReadModelMetadataVersionMock: vi.fn(
    (): Promise<void> => Promise.resolve()
  ),
}));

vi.mock("pagopa-interop-commons", async () => {
  const actual = await vi.importActual("pagopa-interop-commons");
  return {
    ...actual,
    waitForReadModelMetadataVersion: waitForReadModelMetadataVersionMock,
  };
});

describe("IVASS Certified Attributes Importer", () => {
  const tokenGeneratorMock = {} as InteropTokenGenerator;
  const refreshableTokenMock = new RefreshableInteropToken(tokenGeneratorMock);
  const tenantProcessMock = new TenantProcessService("url");

  const interopInternalToken: InteropInternalToken = {
    header: { alg: "algorithm", use: "use", typ: "type", kid: "key-id" },
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

  const refreshableInternalTokenSpy = vi
    .spyOn(refreshableTokenMock, "get")
    .mockImplementation(() => Promise.resolve(interopInternalToken));

  const internalAssignCertifiedAttributeSpy = vi
    .spyOn(tenantProcessMock, "internalAssignCertifiedAttribute")
    .mockImplementation(internalAssignCertifiedAttributeMock);
  const internalRevokeCertifiedAttributeSpy = vi
    .spyOn(tenantProcessMock, "internalRevokeCertifiedAttribute")
    .mockImplementation(internalRevokeCertifiedAttributeMock);

  const pollingConfig = {
    defaultPollingMaxRetries: 1,
    defaultPollingRetryDelay: 1,
  };

  const run = (csvDownloader: () => Promise<string>, batchSize: number = 10) =>
    importAttributes(
      csvDownloader,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      batchSize,
      pollingConfig,
      IVASS_TENANT_ID,
      genericLogger,
      generateId()
    );

  const seedCertifierAndAttribute = async (): Promise<void> => {
    await addOneTenant(buildIvassCertifierTenant());
    await addOneAttribute(buildIvassInsurancesAttribute());
  };

  beforeAll(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanup();
  });

  it("should succeed", async () => {
    await seedCertifierAndAttribute();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678901" },
      attributes: [],
    });

    await run(downloadCSVMock);

    expect(refreshableInternalTokenSpy).toBeCalled();
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should fail if polling max retries are reached after assign", async () => {
    const csv = `${CSV_HEADER}
D0001;2020-12-02;9999-12-31;Org1;0000012345678901`;

    await seedCertifierAndAttribute();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678901" },
      attributes: [],
    });

    internalAssignCertifiedAttributeSpy.mockResolvedValueOnce({ version: 5 });
    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(
      pollingMaxRetriesExceeded(1, 1)
    );

    await expect(run(downloadCSVMockGenerator(csv))).rejects.toThrowError();
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toBeCalled();
  });

  it("should fail if polling max retries are reached after revoke", async () => {
    const csv = `${CSV_HEADER}
D0001;2020-12-02;9999-12-31;Org1;0000012345678901`;

    await seedCertifierAndAttribute();
    // Tenant in CSV — already has attribute → assign skipped
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678901" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    });
    // Tenant NOT in CSV with attribute → revoke will be attempted
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "not_in_csv" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    });

    internalRevokeCertifiedAttributeSpy.mockResolvedValueOnce({ version: 5 });
    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(
      pollingMaxRetriesExceeded(1, 1)
    );

    await expect(run(downloadCSVMockGenerator(csv))).rejects.toThrowError();
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toBeCalled();
  });

  it("should succeed with fields starting with quotes", async () => {
    const csv = `${CSV_HEADER}
D0001;2020-12-02;9999-12-31;"DE ROTTERDAM" BUILDING, 29TH FLOOR, EAST TOWER, WILHELMINAKADE 149A (3072 AP)  ROTTERDAM PAESI BASSI;0000012345678901
`;

    await seedCertifierAndAttribute();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678901" },
      attributes: [],
    });

    await run(downloadCSVMockGenerator(csv));

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed, assigning only missing attributes", async () => {
    const csv = `${CSV_HEADER}
D0001;2020-12-02;9999-12-31;Org1;0000012345678901
D0002;2020-06-10;9999-12-31;Org2;0000012345678902
D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    await seedCertifierAndAttribute();
    // Tenant 1 — has IVASS attribute (skip assign)
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678901" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    });
    // Tenant 2 — has a different attribute (will be assigned IVASS)
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678902" },
      attributes: [{ ...persistentTenantAttribute }],
    });
    // Tenant 3 — no attributes (will be assigned)
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678903" },
      attributes: [],
    });

    await run(downloadCSVMockGenerator(csv));

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed, unassigning expired organizations", async () => {
    const csv = `${CSV_HEADER}
D0001;2020-12-02;2021-12-31;Org1;0000012345678901
D0002;2100-06-10;9999-12-31;Org2;0000012345678902
D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    await seedCertifierAndAttribute();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678901" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    });
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678902" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    });
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678903" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    });

    await run(downloadCSVMockGenerator(csv));

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(2);
  });

  it("should succeed, unassigning only existing attributes", async () => {
    const csv = `${CSV_HEADER}
D0001;2020-12-02;2021-12-31;Org1;0000012345678901
D0002;2020-06-10;2021-12-31;Org2;0000012345678902
D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    await seedCertifierAndAttribute();
    // Only one tenant, with the attribute, NOT matching row3's id → will be revoked
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678901" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    });

    await run(downloadCSVMockGenerator(csv));

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
  });

  it("should succeed, only for tenants that exist on read model", async () => {
    const csv = `${CSV_HEADER}
D0001;2020-12-02;9999-12-31;Org1;0000012345678901
D0002;2020-06-10;2021-12-31;Org2;0000012345678902
D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    await seedCertifierAndAttribute();
    // Only tenant for 12345678903 seeded — row1 (12345678901) has no tenant in DB
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678903" },
      attributes: [{ ...persistentTenantAttribute }],
    });

    await run(downloadCSVMockGenerator(csv));

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed with more than one batch", async () => {
    const csv = `${CSV_HEADER}
D0001;2020-12-02;9999-12-31;Org1;0000012345678901
D0002;2020-06-10;2021-12-31;Org2;0000012345678902
D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    await seedCertifierAndAttribute();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678901" },
      attributes: [{ ...persistentTenantAttribute }],
    });
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678903" },
      attributes: [{ ...persistentTenantAttribute }],
    });

    await run(downloadCSVMockGenerator(csv), 1);

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should fail on CSV retrieve error", async () => {
    await seedCertifierAndAttribute();

    const rejectingDownload = (): Promise<string> =>
      Promise.reject(new Error("CSV Retrieve error"));

    await expect(() => run(rejectingDownload)).rejects.toThrowError(
      "CSV Retrieve error"
    );

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should fail if the tenant is not configured as certifier", async () => {
    const nonCertifierTenant: Tenant = {
      ...persistentTenant,
      id: unsafeBrandId(IVASS_TENANT_ID),
      features: [],
    };
    await addOneTenant(nonCertifierTenant);

    await expect(() => run(downloadCSVMock)).rejects.toThrowError(
      `Tenant with id ${IVASS_TENANT_ID} is not a certifier`
    );

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should skip CSV file rows with unexpected schema", async () => {
    const csv = `${CSV_HEADER}
;Unexpected value;;Org1;0000012345678901
D0002;2020-06-10;2021-12-31;Org2;0000012345678902
D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    await seedCertifierAndAttribute();
    // tenant2 has attribute (not in allOrgsInFile → will be revoked)
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678902" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    });
    // tenant3 active, no IVASS attribute (assign)
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678903" },
      attributes: [{ ...persistentTenantAttribute }],
    });

    await run(downloadCSVMockGenerator(csv));

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
  });

  it("should succeed with missing Tax Code", async () => {
    const csv = `${CSV_HEADER}
D0001;2020-12-02;9999-12-31;Org1;
D0002;2020-06-10;9999-12-31;Org2;0000012345678902
D0003;2019-07-19;9999-12-31;Org3;`;

    await seedCertifierAndAttribute();
    // Tenant 1 — matched by CODICE_IVASS "D0001", has the attribute
    await addOneTenant({
      ...persistentTenant,
      id: unsafeBrandId(randomUUID()),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "D0001" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    });
    // Tenant 2 — matched by CODICE_IVASS "D0003" (no tax code), no attribute
    await addOneTenant({
      ...persistentTenant,
      id: unsafeBrandId(randomUUID()),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "D0003" },
      attributes: [],
    });
    // Tenant 3 — NOT in CSV, has the attribute (will be revoked)
    await addOneTenant({
      ...persistentTenant,
      id: unsafeBrandId(randomUUID()),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "D0005" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    });

    await run(downloadCSVMockGenerator(csv));

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalAssignCertifiedAttributeSpy.mock.calls[0][0]).toEqual(
      IVASS_ORIGIN_NAME
    );
    expect(internalAssignCertifiedAttributeSpy.mock.calls[0][1]).toEqual(
      "D0003"
    );
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(internalRevokeCertifiedAttributeSpy.mock.calls[0][0]).toEqual(
      IVASS_ORIGIN_NAME
    );
    expect(internalRevokeCertifiedAttributeSpy.mock.calls[0][1]).toEqual(
      "D0005"
    );
  });

  it("should unassign attribute for tenants not in the file", async () => {
    const csv = `${CSV_HEADER}
D0003;2019-07-19;9999-12-31;Org3;0000012345678903`;

    await seedCertifierAndAttribute();
    // Tenant in CSV — already has IVASS attribute (skip assign)
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678903" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    });
    // Tenant NOT in CSV — has the attribute, will be revoked
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: { origin: IVASS_ORIGIN_NAME, value: "12345678901" },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_IVASS_INSURANCES_ID),
        },
      ],
    });

    await run(downloadCSVMockGenerator(csv), 1);

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
  });

  it("should fail if the file does not contain records", async () => {
    const csv = `${CSV_HEADER}
`;
    await seedCertifierAndAttribute();

    await expect(() =>
      run(downloadCSVMockGenerator(csv))
    ).rejects.toThrowError("File does not contain valid assignments");

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });
});
