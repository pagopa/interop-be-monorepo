import { AxiosError, AxiosHeaders } from "axios";
import { tenantApi } from "pagopa-interop-api-clients";
import { InteropHeaders, Logger } from "pagopa-interop-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { assignNewAttributes, revokeAttributes } =
  await import("../src/services/ipaCertifiedAttributesImporterService.js");

function problemError(status: number, code: string, title: string): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    {
      status,
      statusText: title,
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {
        type: "about:blank",
        title,
        status,
        detail: "failure detail",
        errors: [{ code, detail: "failure detail" }],
      },
    }
  );
}

const certifiedAttributeAlreadyAssigned = problemError(
  409,
  "005-0014",
  "Conflict"
);

const eventStoreVersionConflict = problemError(
  500,
  "005-9991",
  "Internal Server Error"
);

describe("IPA importer resilience to per-tenant errors", () => {
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

  const readModelServiceSQL = {
    getTenantByExternalIdWithMetadata: vi.fn(async () => ({
      metadata: { version: 5 },
      data: {},
    })),
  };

  const attributesToAssign: tenantApi.InternalTenantSeed[] = [
    {
      externalId: { origin: "IPA", value: "tenant-1" },
      name: "tenant 1",
      certifiedAttributes: [{ origin: "IPA", code: "A1" }],
    },
    {
      externalId: { origin: "IPA", value: "tenant-2" },
      name: "tenant 2",
      certifiedAttributes: [{ origin: "IPA", code: "A2" }],
    },
    {
      externalId: { origin: "IPA", value: "tenant-3" },
      name: "tenant 3",
      certifiedAttributes: [{ origin: "IPA", code: "A3" }],
    },
  ];

  const attributesToRevoke = [
    { tOrigin: "IPA", tExternalId: "tenant-1", aOrigin: "IPA", aCode: "A1" },
    { tOrigin: "IPA", tExternalId: "tenant-2", aOrigin: "IPA", aCode: "A2" },
    { tOrigin: "IPA", tExternalId: "tenant-3", aOrigin: "IPA", aCode: "A3" },
  ];

  const okResponse = { metadata: { version: 5 } };

  beforeEach(() => {
    vi.clearAllMocks();
    waitForReadModelMetadataVersionMock.mockResolvedValue(undefined);
  });

  it("should upsert every tenant even when one of them fails", async () => {
    const internalUpsertTenant = vi
      .fn()
      .mockResolvedValueOnce(okResponse)
      .mockRejectedValueOnce(certifiedAttributeAlreadyAssigned)
      .mockResolvedValueOnce(okResponse);

    const failures = await assignNewAttributes(
      attributesToAssign,
      { internalUpsertTenant } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig
    );

    expect(internalUpsertTenant).toHaveBeenCalledTimes(3);
    expect(failures).toBe(1);
  });

  it("should log the failed upsert with tenant, status and error code", async () => {
    const internalUpsertTenant = vi
      .fn()
      .mockRejectedValue(certifiedAttributeAlreadyAssigned);

    await assignNewAttributes(
      [attributesToAssign[0]],
      { internalUpsertTenant } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("tenant-1")
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("005-0014")
    );
  });

  it("should revoke every attribute even when one of them fails", async () => {
    const internalRevokeCertifiedAttribute = vi
      .fn()
      .mockResolvedValueOnce(okResponse)
      .mockRejectedValueOnce(eventStoreVersionConflict)
      .mockResolvedValueOnce(okResponse);

    const failures = await revokeAttributes(
      attributesToRevoke,
      { internalRevokeCertifiedAttribute } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig
    );

    expect(internalRevokeCertifiedAttribute).toHaveBeenCalledTimes(3);
    expect(failures).toBe(1);
  });
});
