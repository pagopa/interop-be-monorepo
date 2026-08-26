import { InteropHeaders, Logger } from "pagopa-interop-commons";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { afterEach, describe, expect, it, vi } from "vitest";

const internalUpsertTenantMock = vi.fn();
const internalRevokeCertifiedAttributeMock = vi.fn();
const waitForReadModelMetadataVersionMock = vi.fn(
  (): Promise<void> => Promise.resolve()
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

const { assignNewAttributes, createImportState, revokeAttributes } =
  await import("../src/services/ipaCertifiedAttributesImporterService.js");

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
      pollingConfig,
      createImportState()
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
      pollingConfig,
      createImportState()
    );

    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("should not fail assign when polling reaches max retries", async () => {
    internalUpsertTenantMock.mockResolvedValue({ metadata: { version: 5 } });

    const pollingError = pollingMaxRetriesExceeded(1, 1);
    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(pollingError);

    const state = createImportState();

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
      pollingConfig,
      state
    );

    expect(internalUpsertTenantMock).toHaveBeenCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(1);
    expect(state.report.warnings).toBe(1);
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
      pollingConfig,
      createImportState()
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
      pollingConfig,
      createImportState()
    );

    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("should not fail revoke when polling reaches max retries", async () => {
    internalRevokeCertifiedAttributeMock.mockResolvedValue({
      metadata: { version: 5 },
    });

    const pollingError = pollingMaxRetriesExceeded(1, 1);
    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(pollingError);

    const state = createImportState();

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
      pollingConfig,
      state
    );

    expect(internalRevokeCertifiedAttributeMock).toHaveBeenCalledTimes(1);
    expect(waitForReadModelMetadataVersionMock).toHaveBeenCalledTimes(1);
    expect(state.report.warnings).toBe(1);
  });
});
