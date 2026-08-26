import { AxiosError, AxiosHeaders } from "axios";
import { tenantApi } from "pagopa-interop-api-clients";
import { InteropHeaders, Logger } from "pagopa-interop-commons";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
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

const {
  assignNewAttributes,
  createImportState,
  formatRunSummary,
  hasFailedOperations,
  revokeAttributes,
  CERTIFIED_ATTRIBUTE_ALREADY_ASSIGNED_CODE,
  EVENT_CONFLICT_CODE,
  toTenantKey,
} = await import("../src/services/ipaCertifiedAttributesImporterService.js");

function problemError(status: number, code: string): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    {
      status,
      statusText: "Conflict",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {
        type: "about:blank",
        title: "Conflict",
        status,
        detail: "failure detail",
        errors: [{ code, detail: "failure detail" }],
      },
    }
  );
}

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
    waitForReadModelMetadataVersionMock.mockReset();
    waitForReadModelMetadataVersionMock.mockResolvedValue(undefined);
  });

  it("should upsert every tenant even when one of them fails", async () => {
    const internalUpsertTenant = vi
      .fn()
      .mockResolvedValueOnce(okResponse)
      .mockRejectedValueOnce(
        problemError(409, CERTIFIED_ATTRIBUTE_ALREADY_ASSIGNED_CODE)
      )
      .mockResolvedValueOnce(okResponse);

    await assignNewAttributes(
      attributesToAssign,
      { internalUpsertTenant } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      createImportState()
    );

    expect(internalUpsertTenant).toHaveBeenCalledTimes(3);
  });

  it("should log the tenant whose upsert failed", async () => {
    const internalUpsertTenant = vi
      .fn()
      .mockResolvedValueOnce(okResponse)
      .mockRejectedValueOnce(
        problemError(409, CERTIFIED_ATTRIBUTE_ALREADY_ASSIGNED_CODE)
      )
      .mockResolvedValueOnce(okResponse);

    await assignNewAttributes(
      attributesToAssign,
      { internalUpsertTenant } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      createImportState()
    );

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("tenant-2")
    );
  });

  it("should resolve after a failed upsert, so that the revoke phase can start", async () => {
    const internalUpsertTenant = vi
      .fn()
      .mockRejectedValue(problemError(500, "005-0025"));

    await expect(
      assignNewAttributes(
        attributesToAssign,
        { internalUpsertTenant } as never,
        readModelServiceSQL as never,
        headers,
        logger,
        pollingConfig,
        createImportState()
      )
    ).resolves.toBeUndefined();
  });

  it("should revoke every attribute even when one of them fails", async () => {
    const internalRevokeCertifiedAttribute = vi
      .fn()
      .mockResolvedValueOnce(okResponse)
      .mockRejectedValueOnce(problemError(409, EVENT_CONFLICT_CODE))
      .mockResolvedValueOnce(okResponse);

    await revokeAttributes(
      attributesToRevoke,
      { internalRevokeCertifiedAttribute } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      createImportState()
    );

    expect(internalRevokeCertifiedAttribute).toHaveBeenCalledTimes(3);
  });

  it("should log the tenant whose revoke failed", async () => {
    const internalRevokeCertifiedAttribute = vi
      .fn()
      .mockResolvedValueOnce(okResponse)
      .mockRejectedValueOnce(problemError(409, EVENT_CONFLICT_CODE))
      .mockResolvedValueOnce(okResponse);

    await revokeAttributes(
      attributesToRevoke,
      { internalRevokeCertifiedAttribute } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      createImportState()
    );

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("tenant-2")
    );
  });

  it("should not mark the tenant as out of sync when the attribute is already assigned", async () => {
    const internalUpsertTenant = vi
      .fn()
      .mockRejectedValue(
        problemError(409, CERTIFIED_ATTRIBUTE_ALREADY_ASSIGNED_CODE)
      );

    const state = createImportState();

    await assignNewAttributes(
      [attributesToAssign[0]],
      { internalUpsertTenant } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      state
    );

    expect(state.unsyncedTenants.size).toBe(0);
  });

  it("should mark the tenant as out of sync on an event stream conflict", async () => {
    const internalUpsertTenant = vi
      .fn()
      .mockRejectedValue(problemError(409, EVENT_CONFLICT_CODE));

    const state = createImportState();

    await assignNewAttributes(
      [attributesToAssign[0]],
      { internalUpsertTenant } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      state
    );

    expect([...state.unsyncedTenants]).toEqual([
      toTenantKey({ origin: "IPA", value: "tenant-1" }),
    ]);
  });

  it("should skip the following operations on a tenant left out of sync", async () => {
    const internalRevokeCertifiedAttribute = vi
      .fn()
      .mockRejectedValueOnce(problemError(409, EVENT_CONFLICT_CODE))
      .mockResolvedValue(okResponse);

    const state = createImportState();

    await revokeAttributes(
      [
        {
          tOrigin: "IPA",
          tExternalId: "tenant-1",
          aOrigin: "IPA",
          aCode: "A1",
        },
        {
          tOrigin: "IPA",
          tExternalId: "tenant-1",
          aOrigin: "IPA",
          aCode: "A2",
        },
      ],
      { internalRevokeCertifiedAttribute } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      state
    );

    expect(internalRevokeCertifiedAttribute).toHaveBeenCalledTimes(1);
    expect(state.report.skipped).toBe(1);
  });

  it("should keep operating on the other tenants after an event stream conflict", async () => {
    const internalUpsertTenant = vi
      .fn()
      .mockRejectedValueOnce(problemError(409, EVENT_CONFLICT_CODE))
      .mockResolvedValue(okResponse);

    const state = createImportState();

    await assignNewAttributes(
      attributesToAssign,
      { internalUpsertTenant } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      state
    );

    expect(internalUpsertTenant).toHaveBeenCalledTimes(3);
    expect(state.report.skipped).toBe(0);
  });

  it("should count a successful command followed by a failed polling as a success", async () => {
    const internalUpsertTenant = vi.fn().mockResolvedValue(okResponse);

    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(
      pollingMaxRetriesExceeded(1, 1)
    );

    const state = createImportState();

    await assignNewAttributes(
      [attributesToAssign[0]],
      { internalUpsertTenant } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      state
    );

    expect(state.report.upserts).toEqual({ succeeded: 1, failed: 0 });
  });

  it("should mark the tenant as out of sync after a failed polling", async () => {
    const internalUpsertTenant = vi.fn().mockResolvedValue(okResponse);

    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(
      pollingMaxRetriesExceeded(1, 1)
    );

    const state = createImportState();

    await assignNewAttributes(
      [attributesToAssign[0]],
      { internalUpsertTenant } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      state
    );

    expect([...state.unsyncedTenants]).toEqual([
      toTenantKey({ origin: "IPA", value: "tenant-1" }),
    ]);
  });

  it("should keep operating on the other tenants after a failed polling", async () => {
    const internalUpsertTenant = vi.fn().mockResolvedValue(okResponse);

    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(
      pollingMaxRetriesExceeded(1, 1)
    );

    const state = createImportState();

    await assignNewAttributes(
      attributesToAssign,
      { internalUpsertTenant } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      state
    );

    expect(internalUpsertTenant).toHaveBeenCalledTimes(3);
    expect(state.report.skipped).toBe(0);
  });

  it("should mark the tenant as out of sync when the response has no metadata version", async () => {
    const internalUpsertTenant = vi.fn().mockResolvedValue({
      metadata: undefined,
    });

    const state = createImportState();

    await assignNewAttributes(
      [attributesToAssign[0]],
      { internalUpsertTenant } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      state
    );

    expect(waitForReadModelMetadataVersionMock).not.toHaveBeenCalled();
    expect([...state.unsyncedTenants]).toEqual([
      toTenantKey({ origin: "IPA", value: "tenant-1" }),
    ]);
  });

  it("should report consistent counters across assign and revoke", async () => {
    const internalUpsertTenant = vi
      .fn()
      .mockResolvedValueOnce(okResponse)
      .mockRejectedValueOnce(problemError(409, EVENT_CONFLICT_CODE))
      .mockResolvedValueOnce(okResponse);

    const internalRevokeCertifiedAttribute = vi
      .fn()
      .mockResolvedValue(okResponse);

    const state = createImportState();

    await assignNewAttributes(
      attributesToAssign,
      { internalUpsertTenant } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      state
    );

    await revokeAttributes(
      attributesToRevoke,
      { internalRevokeCertifiedAttribute } as never,
      readModelServiceSQL as never,
      headers,
      logger,
      pollingConfig,
      state
    );

    expect(state.report).toEqual({
      upserts: { succeeded: 2, failed: 1 },
      revocations: { succeeded: 2, failed: 0 },
      warnings: 0,
      skipped: 1,
    });
  });

  it("should let an unexpected polling error reach the caller", async () => {
    const internalUpsertTenant = vi.fn().mockResolvedValue(okResponse);

    const databaseError = new Error("connection terminated unexpectedly");
    waitForReadModelMetadataVersionMock.mockRejectedValueOnce(databaseError);

    await expect(
      assignNewAttributes(
        [attributesToAssign[0]],
        { internalUpsertTenant } as never,
        readModelServiceSQL as never,
        headers,
        logger,
        pollingConfig,
        createImportState()
      )
    ).rejects.toThrow(databaseError);
  });
});

describe("Run summary", () => {
  it("should keep upserts and revocations separated", () => {
    const state = createImportState();
    state.report.upserts.succeeded = 3;
    state.report.upserts.failed = 1;
    state.report.revocations.succeeded = 2;
    state.report.revocations.failed = 4;
    state.report.warnings = 5;
    state.report.skipped = 6;

    expect(formatRunSummary(state.report)).toBe(
      "Run summary: upserts 3 succeeded, 1 failed; revocations 2 succeeded, 4 failed; 5 warnings, 6 skipped"
    );
  });

  it("should not report failures for a clean run", () => {
    const state = createImportState();
    state.report.upserts.succeeded = 3;
    state.report.revocations.succeeded = 2;

    expect(hasFailedOperations(state.report)).toBe(false);
  });

  it("should not report failures when the only issue is a polling warning", () => {
    const state = createImportState();
    state.report.upserts.succeeded = 3;
    state.report.warnings = 1;

    expect(hasFailedOperations(state.report)).toBe(false);
  });

  it("should report failures when an upsert failed", () => {
    const state = createImportState();
    state.report.upserts.failed = 1;

    expect(hasFailedOperations(state.report)).toBe(true);
  });

  it("should report failures when a revoke failed", () => {
    const state = createImportState();
    state.report.revocations.failed = 1;

    expect(hasFailedOperations(state.report)).toBe(true);
  });

  it("should report failures when an operation was skipped", () => {
    const state = createImportState();
    state.report.skipped = 1;

    expect(hasFailedOperations(state.report)).toBe(true);
  });
});
