/* eslint-disable functional/immutable-data */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TenantSeed } from "../src/services/ipaCertifiedAttributesImporterService.js";
import type { InternalCertifiedAttribute } from "../src/services/openDataService.js";

const enableSubunitPropagationMock = vi.fn();
const createNewAttributesMock = vi.fn();
const infoMock = vi.fn();
const errorMock = vi.fn();
let tenantSeedsForImporter: TenantSeed[] = [];
let seedsAfterExclusion: TenantSeed[] = [];
const getTenantUpsertDataMock = vi.fn(() => tenantSeedsForImporter);
const getNewAttributesMock = vi.fn(
  (): {
    attributes: InternalCertifiedAttribute[];
    nameConflicts: InternalCertifiedAttribute[];
  } => ({ attributes: [], nameConflicts: [] })
);
const excludeFailedAttributesFromSeedsMock = vi.fn(
  (_seeds: TenantSeed[], _failed: InternalCertifiedAttribute[]) =>
    seedsAfterExclusion
);
const getAttributesToAssignMock = vi.fn(async () => []);

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
      error: errorMock,
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
  getTenantUpsertData: getTenantUpsertDataMock,
  getNewAttributes: getNewAttributesMock,
  createNewAttributes: createNewAttributesMock,
  excludeFailedAttributesFromSeeds: excludeFailedAttributesFromSeedsMock,
  getAttributesToAssign: getAttributesToAssignMock,
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
    errorMock.mockClear();
    tenantSeedsForImporter = [];
    seedsAfterExclusion = [];
    createNewAttributesMock.mockResolvedValue([]);
    getNewAttributesMock.mockReturnValue({ attributes: [], nameConflicts: [] });
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

  it("should exclude and count failed creations and generated-name conflicts", async () => {
    const failedAttribute = {
      origin: "IPA",
      code: "U001",
      name: "Ufficio",
      description: "Ufficio",
    };
    const nameConflict = {
      origin: "IPA",
      code: "U002",
      name: "Ufficio (U002)",
      description: "Ufficio (U002)",
    };
    createNewAttributesMock.mockResolvedValue([failedAttribute]);
    getNewAttributesMock.mockReturnValue({
      attributes: [],
      nameConflicts: [nameConflict],
    });
    tenantSeedsForImporter = [
      {
        origin: "IPA",
        originId: "tenant-1",
        description: "Tenant",
        attributes: [
          { origin: "IPA", code: "U001" },
          { origin: "IPA", code: "U002" },
        ],
      },
    ];
    seedsAfterExclusion = [{ ...tenantSeedsForImporter[0], attributes: [] }];

    await runImporter({ aooUoAttributes: true, forcedPropagation: true });

    expect(excludeFailedAttributesFromSeedsMock).toHaveBeenCalledWith(
      tenantSeedsForImporter,
      [failedAttribute, nameConflict]
    );
    expect(errorMock).toHaveBeenCalledWith(
      'Failed creation of attribute IPA/U002 with name "Ufficio (U002)". Cause: generated attribute name is already in use'
    );
    expect(getAttributesToAssignMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      seedsAfterExclusion,
      expect.anything(),
      expect.anything()
    );
    expect(infoMock).toHaveBeenCalledWith("Revoking attributes");
    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed propagation updates: 0, failed attribute creations/retrievals: 2"
      )
    );
    expect(process.exitCode).toBe(1);
  });
});
