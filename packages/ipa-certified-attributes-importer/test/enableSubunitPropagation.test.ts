import { Logger, InteropHeaders } from "pagopa-interop-commons";
import { getMockAttribute, getMockTenant } from "pagopa-interop-commons-test";
import {
  Attribute,
  ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
  attributeKind,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Institution } from "../src/services/openDataExtractor.js";
import { aoo } from "./expectation.js";

const enableInternalAttributeSubunitPropagationMock = vi.fn();

vi.mock("pagopa-interop-api-clients", async () => {
  const actual = await vi.importActual<
    typeof import("pagopa-interop-api-clients")
  >("pagopa-interop-api-clients");

  return {
    ...actual,
    attributeRegistryApi: {
      ...actual.attributeRegistryApi,
      createAttributeApiClient: vi.fn(() => ({
        enableInternalAttributeSubunitPropagation:
          enableInternalAttributeSubunitPropagationMock,
      })),
    },
  };
});

const { enableSubunitPropagation } =
  await import("../src/services/ipaCertifiedAttributesImporterService.js");

describe("Enable subunit propagation", () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;
  const headers = {} as InteropHeaders;
  const pollingConfig = {
    defaultPollingMaxRetries: 2,
    defaultPollingRetryDelay: 0,
  };

  const aooInstitution: Institution = aoo[0];
  const entityCode = aooInstitution.subUnit?.entityIpaCode ?? "";
  const registryData = { institutions: [aooInstitution], attributes: [] };
  const aooTenant: Tenant = {
    ...getMockTenant(),
    externalId: {
      origin: aooInstitution.origin,
      value: aooInstitution.originId,
    },
  };

  const getEntityAttribute = (
    subunitPropagationEnabled?: boolean
  ): Attribute => ({
    ...getMockAttribute(attributeKind.certified),
    origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
    code: entityCode,
    subunitPropagationEnabled,
  });

  const run = (
    platformAttributes: Attribute[],
    readModelAttributes: Attribute[],
    institutions = registryData
  ): ReturnType<typeof enableSubunitPropagation> =>
    enableSubunitPropagation(
      institutions,
      [aooTenant],
      platformAttributes,
      { getAttributes: vi.fn(async () => readModelAttributes) } as never,
      headers,
      logger,
      "http://attribute-registry",
      pollingConfig
    );

  beforeEach(() => {
    vi.clearAllMocks();
    enableInternalAttributeSubunitPropagationMock.mockResolvedValue(undefined);
  });

  it.each([false, undefined])(
    "should enable the propagation when it is %s and use the confirmed attributes",
    async (initialValue) => {
      const attribute = getEntityAttribute(initialValue);

      const result = await run(
        [attribute],
        [{ ...attribute, subunitPropagationEnabled: true }]
      );

      expect(
        enableInternalAttributeSubunitPropagationMock
      ).toHaveBeenCalledWith(undefined, {
        params: { attributeId: attribute.id },
        headers,
      });
      expect(result.suspendedAttributeIds.size).toBe(0);
      expect(result.failures).toBe(0);
      expect(result.attributes[0].subunitPropagationEnabled).toBe(true);
    }
  );

  it("should not call the process when the propagation is already enabled", async () => {
    const attribute = getEntityAttribute(true);

    const result = await run([attribute], [attribute]);

    expect(
      enableInternalAttributeSubunitPropagationMock
    ).not.toHaveBeenCalled();
    expect(result.failures).toBe(0);
  });

  it("should not enable the propagation of an entity having only SCEC subunits", async () => {
    const attribute = getEntityAttribute(false);
    const scecAoo: Institution = {
      ...aooInstitution,
      category: ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
    };

    await run([attribute], [attribute], {
      institutions: [scecAoo],
      attributes: [],
    });

    expect(
      enableInternalAttributeSubunitPropagationMock
    ).not.toHaveBeenCalled();
  });

  it("should suspend the attribute when the update fails", async () => {
    const attribute = getEntityAttribute(false);
    enableInternalAttributeSubunitPropagationMock.mockRejectedValueOnce(
      new Error("update failed")
    );

    const result = await run([attribute], [attribute]);

    expect(result.suspendedAttributeIds).toEqual(new Set([attribute.id]));
    expect(result.failures).toBe(1);
  });

  it("should suspend the attribute when the read model does not confirm the update", async () => {
    const attribute = getEntityAttribute(false);

    const result = await run([attribute], [attribute]);

    expect(result.suspendedAttributeIds).toEqual(new Set([attribute.id]));
    expect(result.failures).toBe(1);
  });
});
