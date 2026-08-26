import { Logger, InteropHeaders } from "pagopa-interop-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { createImportState, createNewAttributes } =
  await import("../src/services/ipaCertifiedAttributesImporterService.js");

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
      5,
      createImportState()
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
      5,
      createImportState()
    );

    expect(getAttributes).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("should stop waiting after the maximum number of retries", async () => {
    const getAttributes = vi.fn(async () => []);

    await createNewAttributes(
      newAttributes,
      { getAttributes } as never,
      headers,
      logger,
      attributeRegistryUrl,
      waitTime,
      3,
      createImportState()
    );

    expect(getAttributes).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("should count the exhausted wait as a warning in the report", async () => {
    const getAttributes = vi.fn(async () => []);
    const state = createImportState();

    await createNewAttributes(
      newAttributes,
      { getAttributes } as never,
      headers,
      logger,
      attributeRegistryUrl,
      waitTime,
      3,
      state
    );

    expect(state.report.warnings).toBe(1);
  });
});
