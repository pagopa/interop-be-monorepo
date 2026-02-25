import { afterEach, describe, expect, it, vi } from "vitest";
import { InteropHeaders, Logger } from "pagopa-interop-commons";

const internalUpsertTenantMock = vi.fn();
const internalRevokeCertifiedAttributeMock = vi.fn();
const waitForReadModelMetadataVersionMock = vi.fn(
  async (
    _fetchResourceWithMetadata: () => Promise<unknown>,
    targetVersion: number | undefined,
    resourceLabel: string,
    logger: { warn: (message: string) => void }
  ): Promise<void> => {
    if (targetVersion === undefined) {
      logger.warn(
        `Missing metadata version for ${resourceLabel}. Skipping polling.`
      );
    }
  }
);

vi.mock("pagopa-interop-api-clients", async () => {
  const actual = await vi.importActual("pagopa-interop-api-clients");

  return {
    ...actual,
    createZodiosClientEnhancedWithMetadata: vi.fn(() => ({
      internalUpsertTenant: internalUpsertTenantMock,
      internalRevokeCertifiedAttribute: internalRevokeCertifiedAttributeMock,
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

const { assignNewAttributes, revokeAttributes } = await import(
  "../src/services/ipaCertifiedAttributesImporterService.js"
);

describe("IPA metadata polling", () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;

  const headers = {} as InteropHeaders;
  const pollingConfig = {
    defaultPollingMaxRetries: 1,
    defaultPollingRetryDelay: 1,
  };

  const tenantProcessClient = {
    internalUpsertTenant: internalUpsertTenantMock,
    internalRevokeCertifiedAttribute: internalRevokeCertifiedAttributeMock,
  };

  const readModelServiceSQL = {
    getTenantByExternalIdWithMetadata: vi.fn(async () => ({
      metadata: { version: 5 },
      data: {},
    })),
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should poll read model after assign when metadata version is returned", async () => {
    internalUpsertTenantMock.mockResolvedValue({ metadata: { version: 5 } });

    await assignNewAttributes(
      [
        {
          externalId: { origin: "IPA", value: "123" },
          name: "tenant",
          certifiedAttributes: [{ origin: "IPA", code: "A1" }],
        },
      ],
      tenantProcessClient as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig
    );

    expect(internalUpsertTenantMock).toHaveBeenCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("should skip polling after assign when metadata version is missing", async () => {
    internalUpsertTenantMock.mockResolvedValue({ metadata: undefined });

    await assignNewAttributes(
      [
        {
          externalId: { origin: "IPA", value: "123" },
          name: "tenant",
          certifiedAttributes: [{ origin: "IPA", code: "A1" }],
        },
      ],
      tenantProcessClient as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig
    );

    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("should fail assign when polling reaches max retries", async () => {
    internalUpsertTenantMock.mockResolvedValue({ metadata: { version: 5 } });

    const pollingError = new Error("pollingMaxRetriesExceeded");
    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(pollingError);

    await expect(
      assignNewAttributes(
        [
          {
            externalId: { origin: "IPA", value: "123" },
            name: "tenant",
            certifiedAttributes: [{ origin: "IPA", code: "A1" }],
          },
        ],
        tenantProcessClient as never,
        readModelServiceSQL as never,
        headers,
        logger,
        pollingConfig
      )
    ).rejects.toThrowError(pollingError);

    expect(internalUpsertTenantMock).toHaveBeenCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(1);
  });

  it("should poll read model after revoke when metadata version is returned", async () => {
    internalRevokeCertifiedAttributeMock.mockResolvedValue({
      metadata: { version: 5 },
    });

    await revokeAttributes(
      [
        {
          tOrigin: "IPA",
          tExternalId: "123",
          aOrigin: "IPA",
          aCode: "A1",
        },
      ],
      tenantProcessClient as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig
    );

    expect(internalRevokeCertifiedAttributeMock).toHaveBeenCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("should skip polling after revoke when metadata version is missing", async () => {
    internalRevokeCertifiedAttributeMock.mockResolvedValue({
      metadata: undefined,
    });

    await revokeAttributes(
      [
        {
          tOrigin: "IPA",
          tExternalId: "123",
          aOrigin: "IPA",
          aCode: "A1",
        },
      ],
      tenantProcessClient as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig
    );

    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("should fail revoke when polling reaches max retries", async () => {
    internalRevokeCertifiedAttributeMock.mockResolvedValue({
      metadata: { version: 5 },
    });

    const pollingError = new Error("pollingMaxRetriesExceeded");
    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(pollingError);

    await expect(
      revokeAttributes(
        [
          {
            tOrigin: "IPA",
            tExternalId: "123",
            aOrigin: "IPA",
            aCode: "A1",
          },
        ],
        tenantProcessClient as never,
        readModelServiceSQL as never,
        headers,
        logger,
        pollingConfig
      )
    ).rejects.toThrowError(pollingError);

    expect(internalRevokeCertifiedAttributeMock).toHaveBeenCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(1);
  });
});
