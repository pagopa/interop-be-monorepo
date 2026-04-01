import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InteropHeaders,
  Logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { AttributeId, CorrelationId, generateId } from "pagopa-interop-models";

const internalAssignCertifiedAttributeMock = vi.fn();
const internalRevokeCertifiedAttributeMock = vi.fn();
const waitForReadModelMetadataVersionMock = vi.fn(
  (): Promise<void> => Promise.resolve()
);

const MOCK_ADESIONE_ID = generateId<AttributeId>();

vi.mock("pagopa-interop-api-clients", async () => {
  const actual = await vi.importActual("pagopa-interop-api-clients");

  return {
    ...actual,
    createZodiosClientEnhancedWithMetadata: vi.fn(() => ({
      internalAssignCertifiedAttribute: internalAssignCertifiedAttributeMock,
      internalRevokeCertifiedAttribute: internalRevokeCertifiedAttributeMock,
      createInternalCertifiedAttribute: vi.fn(),
    })),
  };
});

vi.mock("pagopa-interop-commons", async () => {
  const actual = await vi.importActual("pagopa-interop-commons");

  return {
    ...actual,
    waitForReadModelMetadataVersion: waitForReadModelMetadataVersionMock,
  };
});

vi.mock("../src/service/attributeService.js", () => ({
  bootstrapRegistryAttributes: vi.fn().mockResolvedValue({
    adesione: {
      id: MOCK_ADESIONE_ID,
      code: "ADESIONE_CODE",
      origin: "SELFCARE",
      name: "Adesione",
    },
    scp: {
      id: "99999999-d843-4dc3-9c09-f62fdf21c210",
      code: "SCP_CODE",
      origin: "SELFCARE",
      name: "SCP",
    },
  }),
}));

const { importAttributes } = await import("../src/service/processor.js");
const { getMockTenant, getMockCertifiedTenantAttribute } =
  await import("pagopa-interop-commons-test");

describe("private-certified-attributes-importer polling", () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;

  const headers = {} as InteropHeaders;
  const correlationId = generateId<CorrelationId>();

  const refreshableToken = {
    get: vi.fn().mockResolvedValue({ serialized: "token" }),
  } as unknown as RefreshableInteropToken;

  const clients = {
    tenantProcessClient: {
      internalAssignCertifiedAttribute: internalAssignCertifiedAttributeMock,
      internalRevokeCertifiedAttribute: internalRevokeCertifiedAttributeMock,
    },
    attributeRegistryClient: {},
  };

  const readModelServiceSQL = {
    getTenantsByOriginPrefix: vi.fn(),
    getTenantsWithAttributes: vi.fn(),
    getTenantByIdWithMetadata: vi.fn(async () => ({
      metadata: { version: 5 },
      data: {},
    })),
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  const assignTenant = {
    ...getMockTenant(),
    externalId: { origin: "PDND_INFOCAMERE", value: "123" },
    selfcareInstitutionType: "PA",
    attributes: [],
  };

  it("should poll read model after assign when API is called", async () => {
    internalAssignCertifiedAttributeMock.mockResolvedValue(undefined);
    readModelServiceSQL.getTenantsByOriginPrefix.mockResolvedValueOnce([
      assignTenant,
    ]);
    readModelServiceSQL.getTenantsWithAttributes.mockResolvedValueOnce([]);

    await importAttributes(
      readModelServiceSQL as never,
      clients as never,
      refreshableToken,
      logger,
      headers,
      correlationId
    );

    expect(internalAssignCertifiedAttributeMock).toHaveBeenCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(1);
  });

  it("should fail assign when polling reaches max retries", async () => {
    internalAssignCertifiedAttributeMock.mockResolvedValue(undefined);
    readModelServiceSQL.getTenantsByOriginPrefix.mockResolvedValueOnce([
      assignTenant,
    ]);
    readModelServiceSQL.getTenantsWithAttributes.mockResolvedValueOnce([]);

    const pollingError = new Error("pollingMaxRetriesExceeded");
    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(pollingError);

    await expect(
      importAttributes(
        readModelServiceSQL as never,
        clients as never,
        refreshableToken,
        logger,
        headers,
        correlationId
      )
    ).rejects.toThrowError(pollingError);

    expect(internalAssignCertifiedAttributeMock).toHaveBeenCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(1);
  });

  const revokeTenant = {
    ...getMockTenant(),
    externalId: { origin: "IPA", value: "123" },
    selfcareInstitutionType: "PA",
    attributes: [
      {
        ...getMockCertifiedTenantAttribute(MOCK_ADESIONE_ID),
        revocationTimestamp: undefined,
      },
    ],
  };

  it("should poll read model after revoke when API is called", async () => {
    internalRevokeCertifiedAttributeMock.mockResolvedValue(undefined);
    readModelServiceSQL.getTenantsByOriginPrefix.mockResolvedValueOnce([]);
    readModelServiceSQL.getTenantsWithAttributes.mockResolvedValueOnce([
      revokeTenant,
    ]);

    await importAttributes(
      readModelServiceSQL as never,
      clients as never,
      refreshableToken,
      logger,
      headers,
      correlationId
    );

    expect(internalRevokeCertifiedAttributeMock).toHaveBeenCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(1);
  });

  it("should fail revoke when polling reaches max retries", async () => {
    internalRevokeCertifiedAttributeMock.mockResolvedValue(undefined);
    readModelServiceSQL.getTenantsByOriginPrefix.mockResolvedValueOnce([]);
    readModelServiceSQL.getTenantsWithAttributes.mockResolvedValueOnce([
      revokeTenant,
    ]);

    const pollingError = new Error("pollingMaxRetriesExceeded");
    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(pollingError);

    await expect(
      importAttributes(
        readModelServiceSQL as never,
        clients as never,
        refreshableToken,
        logger,
        headers,
        correlationId
      )
    ).rejects.toThrowError(pollingError);

    expect(internalRevokeCertifiedAttributeMock).toHaveBeenCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(1);
  });
});
