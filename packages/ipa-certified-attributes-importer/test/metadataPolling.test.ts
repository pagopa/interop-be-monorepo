import { afterEach, describe, expect, it, vi } from "vitest";
import { InteropHeaders, Logger } from "pagopa-interop-commons";

const internalUpsertTenantMock = vi.fn();
const internalRevokeCertifiedAttributeMock = vi.fn();
const createPollingByConditionMock = vi.fn();

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
    createPollingByCondition: createPollingByConditionMock,
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

  type PollingRunnerArgs = {
    condition: (pollingResult: unknown) => boolean;
  };

  const buildPollingRunner = (): ReturnType<typeof vi.fn> =>
    vi.fn(async ({ condition }: PollingRunnerArgs): Promise<void> => {
      const readModelEntry =
        await readModelServiceSQL.getTenantByExternalIdWithMetadata();
      expect(condition(readModelEntry)).toBe(true);
    });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should poll read model after assign when metadata version is returned", async () => {
    internalUpsertTenantMock.mockResolvedValue({ metadata: { version: 5 } });

    const pollingRunner = buildPollingRunner();

    createPollingByConditionMock.mockReturnValue(pollingRunner);

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
      logger
    );

    expect(internalUpsertTenantMock).toHaveBeenCalledTimes(1);
    expect(createPollingByConditionMock).toHaveBeenCalledTimes(1);
    expect(pollingRunner).toHaveBeenCalledTimes(1);
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
      logger
    );

    expect(createPollingByConditionMock).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("should poll read model after revoke when metadata version is returned", async () => {
    internalRevokeCertifiedAttributeMock.mockResolvedValue({
      metadata: { version: 5 },
    });

    const pollingRunner = buildPollingRunner();

    createPollingByConditionMock.mockReturnValue(pollingRunner);

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
      logger
    );

    expect(internalRevokeCertifiedAttributeMock).toHaveBeenCalledTimes(1);
    expect(createPollingByConditionMock).toHaveBeenCalledTimes(1);
    expect(pollingRunner).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
