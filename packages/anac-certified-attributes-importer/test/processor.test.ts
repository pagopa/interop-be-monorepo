/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  InteropInternalToken,
  InteropTokenGenerator,
  RefreshableInteropToken,
  genericLogger,
} from "pagopa-interop-commons";
import {
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { TenantProcessService } from "../src/service/tenantProcessService.js";
import { SftpClient } from "../src/service/sftpService.js";
import {
  ANAC_ASSIGNED_CODE,
  ANAC_ENABLED_CODE,
  ANAC_IN_VALIDATION_CODE,
  importAttributes,
} from "../src/service/processor.js";
import {
  ANAC_TENANT_ID,
  ATTRIBUTE_ANAC_ASSIGNED_ID,
  ATTRIBUTE_ANAC_ENABLED_ID,
  ATTRIBUTE_ANAC_IN_VALIDATION_ID,
  CSV_HEADER,
  addOneAttribute,
  addOneTenant,
  cleanup,
  buildAnacAttribute,
  buildAnacCertifierTenant,
  downloadCSVMock,
  downloadCSVMockGenerator,
  internalAssignCertifiedAttributeMock,
  internalRevokeCertifiedAttributeMock,
  persistentTenant,
  persistentTenantAttribute,
  readModelQueries,
  sftpConfigTest,
} from "./helpers.js";

const waitForReadModelMetadataVersionMock = vi.fn(
  (): Promise<void> => Promise.resolve()
);

vi.mock("pagopa-interop-commons", async () => {
  const actual = await vi.importActual("pagopa-interop-commons");
  return {
    ...actual,
    waitForReadModelMetadataVersion: waitForReadModelMetadataVersionMock,
  };
});

describe("ANAC Certified Attributes Importer", () => {
  const tokenGeneratorMock = {} as InteropTokenGenerator;
  const refreshableTokenMock = new RefreshableInteropToken(tokenGeneratorMock);
  const tenantProcessMock = new TenantProcessService("url");
  const sftpClientMock = new SftpClient(sftpConfigTest);

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

  const run = (batchSize: number = 10) =>
    importAttributes(
      sftpClientMock,
      readModelQueries,
      tenantProcessMock,
      refreshableTokenMock,
      batchSize,
      pollingConfig,
      ANAC_TENANT_ID,
      genericLogger,
      generateId()
    );

  const seedCertifierAndAttributes = async (): Promise<void> => {
    await addOneTenant(buildAnacCertifierTenant());
    await addOneAttribute(
      buildAnacAttribute(ATTRIBUTE_ANAC_ENABLED_ID, ANAC_ENABLED_CODE)
    );
    await addOneAttribute(
      buildAnacAttribute(ATTRIBUTE_ANAC_ASSIGNED_ID, ANAC_ASSIGNED_CODE)
    );
    await addOneAttribute(
      buildAnacAttribute(
        ATTRIBUTE_ANAC_IN_VALIDATION_ID,
        ANAC_IN_VALIDATION_CODE
      )
    );
  };

  beforeAll(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanup();
  });

  it("should succeed", async () => {
    const csv = `${CSV_HEADER}
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,TRUE,TRUE,TRUE`;
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(downloadCSVMockGenerator(csv));

    await seedCertifierAndAttributes();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: {
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        value: "ipa_code_123",
      },
      attributes: [],
    });

    await run();

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(refreshableInternalTokenSpy).toBeCalled();
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(3);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should fail if polling max retries are reached after assign", async () => {
    const csv = `${CSV_HEADER}
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,FALSE,TRUE,FALSE`;
    vi.spyOn(sftpClientMock, "downloadCSV").mockImplementation(
      downloadCSVMockGenerator(csv)
    );

    await seedCertifierAndAttributes();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: {
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        value: "ipa_code_123",
      },
      attributes: [],
    });

    internalAssignCertifiedAttributeSpy.mockResolvedValueOnce({ version: 5 });
    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(
      pollingMaxRetriesExceeded(1, 1)
    );

    await expect(run()).rejects.toThrowError();
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toBeCalled();
  });

  it("should fail if polling max retries are reached after revoke", async () => {
    const csv = `${CSV_HEADER}
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,FALSE,FALSE,FALSE`;
    vi.spyOn(sftpClientMock, "downloadCSV").mockImplementation(
      downloadCSVMockGenerator(csv)
    );

    await seedCertifierAndAttributes();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: {
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        value: "ipa_code_123",
      },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
        },
      ],
    });

    internalRevokeCertifiedAttributeSpy.mockResolvedValueOnce({ version: 5 });
    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(
      pollingMaxRetriesExceeded(1, 1)
    );

    await expect(run()).rejects.toThrowError();
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toBeCalled();
  });

  it("should succeed, assigning only missing attributes", async () => {
    const csv = `${CSV_HEADER}
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,TRUE,TRUE,TRUE`;
    vi.spyOn(sftpClientMock, "downloadCSV").mockImplementation(
      downloadCSVMockGenerator(csv)
    );

    await seedCertifierAndAttributes();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: {
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        value: "ipa_code_123",
      },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
        },
      ],
    });

    await run();

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed, unassigning only existing attributes", async () => {
    const csv = `${CSV_HEADER}
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,FALSE,FALSE,FALSE`;
    vi.spyOn(sftpClientMock, "downloadCSV").mockImplementation(
      downloadCSVMockGenerator(csv)
    );

    await seedCertifierAndAttributes();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: {
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        value: "ipa_code_123",
      },
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
    });

    await run();

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(2);
  });

  it("should succeed, only for tenants that exist on read model", async () => {
    const csv = `${CSV_HEADER}
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,TRUE,TRUE,TRUE
9876543210,Org name not in Tenants,gsp2@pec.it,ipa_code_456,TRUE,TRUE,TRUE`;
    vi.spyOn(sftpClientMock, "downloadCSV").mockImplementation(
      downloadCSVMockGenerator(csv)
    );

    await seedCertifierAndAttributes();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: {
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        value: "ipa_code_123",
      },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
        },
      ],
    });

    await run();

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed with more than one batch", async () => {
    const csv = `${CSV_HEADER}
0123456789,Org name in IPA,gsp1@pec.it,ipa_code_123,TRUE,TRUE,TRUE
9876543210,Org name not in Tenants,gsp2@pec.it,ipa_code_456,TRUE,TRUE,TRUE
9876543299,Org name not in Tenants,gsp3@pec.it,ipa_code_789,TRUE,TRUE,TRUE`;
    vi.spyOn(sftpClientMock, "downloadCSV").mockImplementation(
      downloadCSVMockGenerator(csv)
    );

    await seedCertifierAndAttributes();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: {
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        value: "ipa_code_123",
      },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
        },
      ],
    });

    await run(1);

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed, unassign attributes for tenants not in the file", async () => {
    const csv = `${CSV_HEADER}
0123456781,Org name in IPA,gsp1@pec.it,ipa_code_1,TRUE,TRUE,TRUE`;
    vi.spyOn(sftpClientMock, "downloadCSV").mockImplementation(
      downloadCSVMockGenerator(csv)
    );

    await seedCertifierAndAttributes();

    // Tenant in CSV — has all 3 attributes, nothing to assign or revoke
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: {
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        value: "ipa_code_1",
      },
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
    });

    // Tenants NOT in CSV but with ANAC attributes — should be revoked
    const orphanTenantsAttributes = [
      [ATTRIBUTE_ANAC_ENABLED_ID],
      [ATTRIBUTE_ANAC_ASSIGNED_ID],
      [ATTRIBUTE_ANAC_IN_VALIDATION_ID],
      [
        ATTRIBUTE_ANAC_ENABLED_ID,
        ATTRIBUTE_ANAC_ASSIGNED_ID,
        ATTRIBUTE_ANAC_IN_VALIDATION_ID,
      ],
    ];
    for (const [idx, attrs] of orphanTenantsAttributes.entries()) {
      await addOneTenant({
        ...persistentTenant,
        id: generateId(),
        externalId: {
          origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
          value: `ipa_code_orphan_${idx}`,
        },
        attributes: attrs.map((id) => ({
          ...persistentTenantAttribute,
          id: unsafeBrandId(id),
        })),
      });
    }

    await run();

    const totalRevokes = orphanTenantsAttributes.flat().length;
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(totalRevokes);
  });

  it("should succeed, case insensivity for IPA code", async () => {
    const csv = `${CSV_HEADER}
0123456789,Org name in IPA,gsp1@pec.it,ipa_CODE_123,TRUE,TRUE,TRUE`;
    vi.spyOn(sftpClientMock, "downloadCSV").mockImplementation(
      downloadCSVMockGenerator(csv)
    );

    await seedCertifierAndAttributes();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: {
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        value: "ipa_code_123",
      },
      attributes: [],
    });

    await run();

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(3);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should succeed, unassigning existing attributes with case insensivity for IPA code", async () => {
    const csv = `${CSV_HEADER}
0123456789,Org name in IPA,gsp1@pec.it,ipa_CODE_123,TRUE,TRUE,FALSE`;
    vi.spyOn(sftpClientMock, "downloadCSV").mockImplementation(
      downloadCSVMockGenerator(csv)
    );

    await seedCertifierAndAttributes();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: {
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        value: "ipa_code_123",
      },
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
    });

    await run();

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(1);
  });

  it("should fail on CSV retrieve error", async () => {
    await seedCertifierAndAttributes();

    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(() =>
        Promise.reject(new Error("CSV Retrieve error"))
      );

    await expect(() => run()).rejects.toThrowError("CSV Retrieve error");

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should fail if the tenant is not configured as certifier", async () => {
    const downloadCSVSpy = vi
      .spyOn(sftpClientMock, "downloadCSV")
      .mockImplementation(downloadCSVMock);

    const nonCertifierTenant: Tenant = {
      ...persistentTenant,
      id: unsafeBrandId(ANAC_TENANT_ID),
      features: [],
    };
    await addOneTenant(nonCertifierTenant);

    await expect(() => run()).rejects.toThrowError(
      `Tenant with id ${ANAC_TENANT_ID} is not a certifier`
    );

    expect(downloadCSVSpy).toBeCalledTimes(1);
    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(0);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });

  it("should skip CSV file rows with unexpected schema", async () => {
    const csv = `${CSV_HEADER}
    ,Wrong format row,gsp1@pec.it,ipa_code_123,TRUE,TRUE,
    ,Wrong "quotes" row,gsp1@pec.it,ipa_code_123,TRUE,TRUE,TRUE
    0123456789,"Org name, in IPA",gsp1@pec.it,ipa_code_123,TRUE,TRUE,TRUE`;
    vi.spyOn(sftpClientMock, "downloadCSV").mockImplementation(
      downloadCSVMockGenerator(csv)
    );

    await seedCertifierAndAttributes();
    await addOneTenant({
      ...persistentTenant,
      id: generateId(),
      externalId: {
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        value: "ipa_code_123",
      },
      attributes: [
        {
          ...persistentTenantAttribute,
          id: unsafeBrandId(ATTRIBUTE_ANAC_ENABLED_ID),
        },
      ],
    });

    await run();

    expect(internalAssignCertifiedAttributeSpy).toBeCalledTimes(2);
    expect(internalRevokeCertifiedAttributeSpy).toBeCalledTimes(0);
  });
});
