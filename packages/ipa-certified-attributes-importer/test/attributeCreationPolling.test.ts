import { Logger, InteropHeaders } from "pagopa-interop-commons";
import { getMockAttribute, getMockTenant } from "pagopa-interop-commons-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config } from "../src/config/config.js";
import { Institution } from "../src/services/openDataExtractor.js";

const createInternalCertifiedAttributeMock = vi.fn();

vi.mock("pagopa-interop-api-clients", async () => {
  const actual = await vi.importActual<
    typeof import("pagopa-interop-api-clients")
  >("pagopa-interop-api-clients");

  return {
    ...actual,
    attributeRegistryApi: {
      ...actual.attributeRegistryApi,
      createAttributeApiClient: vi.fn(() => ({
        createInternalCertifiedAttribute: createInternalCertifiedAttributeMock,
      })),
    },
  };
});

const {
  assignNewAttributes,
  buildTenantsIndex,
  createNewAttributes,
  excludeFailedAttributesFromSeeds,
  getAttributesToAssign,
  getAttributesToRevoke,
  getNewAttributes,
  getTenantUpsertData,
} = await import("../src/services/ipaCertifiedAttributesImporterService.js");

describe("Attribute creation polling", () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;

  const headers = {} as InteropHeaders;
  const attributeRegistryUrl = "http://attribute-registry";
  const waitTime = 0;

  const newAttributes = [
    {
      code: "A1",
      description: "attribute 1",
      origin: "IPA",
      name: "attribute 1",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not wait when there are no attributes to create", async () => {
    const getAttributes = vi.fn(async () => []);

    await createNewAttributes(
      [],
      { getAttributes } as never,
      headers,
      logger,
      attributeRegistryUrl,
      waitTime,
      5
    );

    expect(createInternalCertifiedAttributeMock).not.toHaveBeenCalled();
    expect(getAttributes).not.toHaveBeenCalled();
  });

  it("should stop waiting as soon as the attributes reach the read model", async () => {
    const getAttributes = vi.fn(async () => [
      {
        id: "attribute-id",
        name: "attribute 1",
        code: "A1",
        origin: "IPA",
        kind: "Certified",
        description: "attribute 1",
        creationTime: new Date(),
      },
    ]);

    await createNewAttributes(
      newAttributes,
      { getAttributes } as never,
      headers,
      logger,
      attributeRegistryUrl,
      waitTime,
      5
    );

    expect(getAttributes).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("should stop waiting after the maximum number of retries and return the missing attributes", async () => {
    const getAttributes = vi.fn(async () => []);

    const failedAttributes = await createNewAttributes(
      newAttributes,
      { getAttributes } as never,
      headers,
      logger,
      attributeRegistryUrl,
      waitTime,
      3
    );

    expect(getAttributes).toHaveBeenCalledTimes(3);
    expect(failedAttributes).toEqual(newAttributes);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed retrieval of attribute IPA/A1 with name "attribute 1". Attribute not found in the read model after 3 attempts'
    );
  });

  it("should exclude only attributes still missing after polling", async () => {
    const secondAttribute = {
      code: "A2",
      description: "attribute 2",
      origin: "IPA",
      name: "attribute 2",
    };
    const getAttributes = vi
      .fn()
      .mockResolvedValueOnce([{ ...secondAttribute, kind: "Certified" }])
      .mockResolvedValueOnce([{ ...newAttributes[0], kind: "Certified" }]);

    const failed = await createNewAttributes(
      [...newAttributes, secondAttribute],
      { getAttributes } as never,
      headers,
      logger,
      attributeRegistryUrl,
      waitTime,
      2
    );

    expect(failed).toEqual([secondAttribute]);
    expect(getAttributes).toHaveBeenCalledTimes(2);
  });
});

describe("Attribute creation errors", () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;

  const headers = {} as InteropHeaders;
  const attributeRegistryUrl = "http://attribute-registry";
  const waitTime = 0;

  const newAttributes = [
    {
      code: "A1",
      description: "attribute 1",
      origin: "IPA",
      name: "attribute 1",
    },
    {
      code: "A2",
      description: "attribute 2",
      origin: "IPA",
      name: "attribute 2",
    },
  ];

  const getAttributes = vi.fn(async () => [
    {
      id: "attribute-id",
      name: "attribute 2",
      code: "A2",
      origin: "IPA",
      kind: "Certified",
      description: "attribute 2",
      creationTime: new Date(),
    },
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
    createInternalCertifiedAttributeMock.mockRejectedValueOnce(
      new Error("An attribute with name attribute 1 already exists")
    );
  });

  it("should create the next attributes after a failed creation", async () => {
    await createNewAttributes(
      newAttributes,
      { getAttributes } as never,
      headers,
      logger,
      attributeRegistryUrl,
      waitTime,
      5
    );

    expect(createInternalCertifiedAttributeMock).toHaveBeenCalledTimes(2);
  });

  it("should return the failed attributes", async () => {
    const failedAttributes = await createNewAttributes(
      newAttributes,
      { getAttributes } as never,
      headers,
      logger,
      attributeRegistryUrl,
      waitTime,
      5
    );

    expect(failedAttributes).toEqual([newAttributes[0]]);
  });

  it("should wait only for the created attributes", async () => {
    await createNewAttributes(
      newAttributes,
      { getAttributes } as never,
      headers,
      logger,
      attributeRegistryUrl,
      waitTime,
      5
    );

    expect(getAttributes).toHaveBeenCalledTimes(1);
  });

  it("should log an error with code, name and cause for a failed creation", async () => {
    await createNewAttributes(
      newAttributes,
      { getAttributes } as never,
      headers,
      logger,
      attributeRegistryUrl,
      waitTime,
      5
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Failed creation of attribute IPA/A1 with name "attribute 1". Error: An attribute with name attribute 1 already exists'
    );
  });
});

describe("Attribute name conflicts", () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;

  const nameConflict = {
    code: "U1",
    description: "unit (U1)",
    origin: "IPA",
    name: "unit (U1)",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    config.featureFlagAooUoAttributes = false;
  });

  it("should count a registry name conflict and continue with other attributes", async () => {
    const category = {
      code: "C1",
      description: "category",
      origin: "IPA",
      name: "category",
    };
    const nextAttribute = {
      code: "U2",
      description: "unit 2",
      origin: "IPA",
      name: "unit 2",
    };
    const getAttributes = vi.fn(async () => [
      { ...getMockAttribute(), ...category, kind: "Certified" },
      { ...getMockAttribute(), ...nextAttribute, kind: "Certified" },
    ]);
    createInternalCertifiedAttributeMock.mockReset();
    createInternalCertifiedAttributeMock
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("name already exists"))
      .mockResolvedValueOnce({});

    const failed = await createNewAttributes(
      [category, nameConflict, nextAttribute],
      { getAttributes } as never,
      {} as InteropHeaders,
      logger,
      "http://attribute-registry",
      0,
      1
    );

    expect(failed).toEqual([nameConflict]);
    expect(createInternalCertifiedAttributeMock).toHaveBeenCalledTimes(3);
    expect(createInternalCertifiedAttributeMock).toHaveBeenNthCalledWith(
      1,
      category,
      expect.any(Object)
    );
    expect(createInternalCertifiedAttributeMock).toHaveBeenNthCalledWith(
      3,
      nextAttribute,
      expect.any(Object)
    );
  });

  it("should count a generated A4 suffix conflict and continue creating attributes", async () => {
    const institutions: Institution[] = ["A001", "A002"].map((originId) => ({
      id: `tax-${originId}`,
      origin: "IPA",
      originId,
      description: originId,
      category: "category",
      kind: "Stazioni Appaltanti",
      classification: "AOO",
      subUnit: { name: "Unit", entityName: "Entity", entityIpaCode: "ROOT" },
    }));
    const tenants = institutions.map((institution) => ({
      ...getMockTenant(),
      externalId: { origin: "IPA", value: institution.originId },
      attributes: [],
    }));
    const platformAttributes = [
      { ...getMockAttribute(), name: "Unit di Entity (A001)" },
    ];
    const registryData = { institutions, attributes: [] };
    config.featureFlagAooUoAttributes = true;
    const seeds = getTenantUpsertData(registryData, tenants, []);
    const getAttributes = vi.fn(async () => [
      {
        ...getMockAttribute(),
        kind: "Certified",
        origin: "IPA",
        code: "A002",
      },
    ]);

    const generatedAttributes = getNewAttributes(
      registryData,
      seeds,
      platformAttributes
    );
    createInternalCertifiedAttributeMock.mockReset();
    createInternalCertifiedAttributeMock.mockResolvedValue({});
    const failed = await createNewAttributes(
      generatedAttributes.attributes,
      { getAttributes } as never,
      {} as InteropHeaders,
      logger,
      "http://attribute-registry",
      0,
      1
    );
    failed.push(...generatedAttributes.nameConflicts);

    expect(failed.map((attribute) => attribute.code)).toEqual(["A001"]);
    expect(createInternalCertifiedAttributeMock).toHaveBeenCalledTimes(1);
    expect(createInternalCertifiedAttributeMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: "A002" }),
      expect.any(Object)
    );
  });
});

describe("Failed attributes exclusion from tenant seeds", () => {
  it("should remove only the failed attributes from the tenant seeds", () => {
    const seeds = [
      {
        origin: "IPA",
        originId: "U1",
        description: "unit",
        attributes: [
          { origin: "IPA", code: "C1" },
          { origin: "IPA", code: "U1" },
        ],
      },
    ];

    expect(
      excludeFailedAttributesFromSeeds(seeds, [
        { origin: "IPA", code: "U1", name: "unit", description: "unit" },
      ])
    ).toEqual([{ ...seeds[0], attributes: [{ origin: "IPA", code: "C1" }] }]);
  });

  it("should continue A3 and A4 assignment for subunits after one A4 creation fails", async () => {
    const subunits: Institution[] = ["A001", "A002"].map((code) => ({
      id: `tax-${code}`,
      origin: "IPA",
      originId: code,
      description: code,
      category: "category",
      kind: "Stazioni Appaltanti",
      classification: "AOO",
      subUnit: { name: code, entityName: "Entity", entityIpaCode: "ROOT" },
    }));
    const registryData = { institutions: subunits, attributes: [] };
    const tenants = subunits.map((institution) => ({
      ...getMockTenant(),
      externalId: { origin: institution.origin, value: institution.originId },
      attributes: [],
    }));
    const platformAttributes = [
      {
        ...getMockAttribute(),
        kind: "Certified" as const,
        origin: "IPA",
        code: "ROOT",
        subunitPropagationEnabled: true,
      },
      {
        ...getMockAttribute(),
        kind: "Certified" as const,
        origin: "IPA",
        code: "category",
      },
    ];
    const createdAttribute = {
      ...getMockAttribute(),
      kind: "Certified" as const,
      origin: "IPA",
      code: "A002",
    };
    const getAttributes = vi.fn(async () => [
      ...platformAttributes,
      createdAttribute,
    ]);
    const internalUpsertTenant = vi.fn(async () => ({ metadata: undefined }));
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;

    config.featureFlagAooUoAttributes = true;
    createInternalCertifiedAttributeMock.mockReset();
    createInternalCertifiedAttributeMock
      .mockRejectedValueOnce(new Error("registry unavailable"))
      .mockResolvedValueOnce({});

    const seeds = getTenantUpsertData(
      registryData,
      tenants,
      [],
      platformAttributes
    );
    const failed = await createNewAttributes(
      getNewAttributes(registryData, seeds, platformAttributes).attributes,
      { getAttributes } as never,
      {} as InteropHeaders,
      logger,
      "http://attribute-registry",
      0,
      2
    );
    const toAssign = await getAttributesToAssign(
      buildTenantsIndex(tenants),
      platformAttributes,
      excludeFailedAttributesFromSeeds(seeds, failed),
      config,
      logger
    );

    await assignNewAttributes(
      toAssign,
      { internalUpsertTenant } as never,
      { getAttributes } as never,
      {} as InteropHeaders,
      logger,
      { defaultPollingMaxRetries: 1, defaultPollingRetryDelay: 0 }
    );

    expect(failed.map((attribute) => attribute.code)).toEqual(["A001"]);
    expect(internalUpsertTenant).toHaveBeenCalledTimes(2);
    expect(toAssign.map((seed) => seed.certifiedAttributes)).toEqual([
      [
        { origin: "IPA", code: "category" },
        { origin: "IPA", code: "ROOT" },
      ],
      [
        { origin: "IPA", code: "category" },
        { origin: "IPA", code: "ROOT" },
        { origin: "IPA", code: "A002" },
      ],
    ]);
    expect(
      await getAttributesToRevoke(seeds, tenants, platformAttributes)
    ).toEqual([]);
  });

  afterEach(() => {
    config.featureFlagAooUoAttributes = false;
  });
});
