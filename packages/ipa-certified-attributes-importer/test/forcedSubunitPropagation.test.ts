/* eslint-disable functional/immutable-data */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enableSubunitPropagationMock = vi.fn();
const createNewAttributesMock = vi.fn();
const infoMock = vi.fn();

vi.mock("pagopa-interop-commons", async () => {
  const actual = await vi.importActual<typeof import("pagopa-interop-commons")>(
    "pagopa-interop-commons"
  );

  return {
    ...actual,
    InteropTokenGenerator: vi.fn(function () {
      return {};
    }),
    RefreshableInteropToken: class {
      init = vi.fn();
      get = vi.fn(async () => ({ serialized: "token" }));
    },
    getInteropHeaders: vi.fn(() => ({})),
    logger: vi.fn(() => ({
      info: infoMock,
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  };
});

vi.mock("pagopa-interop-readmodel", () => ({
  makeDrizzleConnectionWithCleanup: vi.fn(() => ({
    db: {},
    cleanup: vi.fn(),
  })),
  attributeReadModelServiceBuilder: vi.fn(),
  tenantReadModelServiceBuilder: vi.fn(),
}));

vi.mock("../src/services/readModelServiceSQL.js", () => ({
  readModelServiceBuilderSQL: vi.fn(() => ({
    getAttributes: vi.fn(async () => []),
    getIPATenants: vi.fn(async () => []),
  })),
}));

vi.mock("../src/services/openDataService.js", () => ({
  getRegistryData: vi.fn(async () => ({ institutions: [], attributes: [] })),
}));

vi.mock("../src/services/ipaCertifiedAttributesImporterService.js", () => ({
  createTenantProcessClient: vi.fn(),
  enableSubunitPropagation: enableSubunitPropagationMock,
  getTenantUpsertData: vi.fn(() => []),
  getNewAttributes: vi.fn(() => []),
  createNewAttributes: createNewAttributesMock,
  excludeFailedAttributesFromSeeds: vi.fn(() => []),
  getAttributesToAssign: vi.fn(async () => []),
  assignNewAttributes: vi.fn(async () => 0),
  getAttributesToRevoke: vi.fn(async () => []),
  revokeAttributes: vi.fn(async () => 0),
}));

describe("Forced subunit propagation", () => {
  const runImporter = async (flags: {
    aooUoAttributes: boolean;
    forcedPropagation: boolean;
  }): Promise<void> => {
    vi.resetModules();
    const { config } = await import("../src/config/config.js");
    config.featureFlagAooUoAttributes = flags.aooUoAttributes;
    config.featureFlagAooUoAttributesForcedPropagation =
      flags.forcedPropagation;

    await import("../src/index.js");
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    createNewAttributesMock.mockResolvedValue([]);
    enableSubunitPropagationMock.mockResolvedValue({
      attributes: [],
      suspendedAttributeIds: new Set(),
      failures: 0,
    });
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it("should enable the subunit propagation when both feature flags are enabled", async () => {
    await runImporter({ aooUoAttributes: true, forcedPropagation: true });

    expect(enableSubunitPropagationMock).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBeUndefined();
  });

  it.each([
    { aooUoAttributes: false, forcedPropagation: true },
    { aooUoAttributes: true, forcedPropagation: false },
    { aooUoAttributes: false, forcedPropagation: false },
  ])(
    "should not enable the subunit propagation when the feature flags are %o",
    async (flags) => {
      await runImporter(flags);

      expect(enableSubunitPropagationMock).not.toHaveBeenCalled();
    }
  );

  it("should set the exit code to 1 when a propagation update fails", async () => {
    enableSubunitPropagationMock.mockResolvedValue({
      attributes: [],
      suspendedAttributeIds: new Set(["attribute-id"]),
      failures: 1,
    });

    await runImporter({ aooUoAttributes: true, forcedPropagation: true });

    expect(process.exitCode).toBe(1);
  });

  it("should report failed A4 creations, continue the job and set the exit code", async () => {
    const failedAttribute = {
      origin: "IPA",
      code: "U001",
      name: "Ufficio",
      description: "Ufficio",
    };
    createNewAttributesMock.mockResolvedValue([failedAttribute]);

    await runImporter({ aooUoAttributes: true, forcedPropagation: true });

    expect(infoMock).toHaveBeenCalledWith("Revoking attributes");
    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed propagation updates: 0, failed attribute creations: 1"
      )
    );
    expect(process.exitCode).toBe(1);
  });
});
