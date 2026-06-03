import { genericLogger, WithLogger } from "pagopa-interop-commons";
import {
  getMockedApiAttribute,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { attributeRegistryApi, tenantApi } from "pagopa-interop-api-clients";
import { AttributeId, TenantId, generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { tenantServiceBuilder } from "../src/services/tenantService.js";
import { BffAppContext } from "../src/utilities/context.js";

describe("tenantServiceBuilder.getTenant", () => {
  it("should include certified and certified discrete attributes in tenant certified attributes", async () => {
    const tenantId = generateId<TenantId>();
    const certifiedAttributeId = generateId<AttributeId>();
    const certifiedDiscreteAttributeId = generateId<AttributeId>();
    const assignmentTimestamp = new Date().toISOString();

    const tenant: tenantApi.Tenant = {
      ...getMockedApiTenant({
        attributes: [
          {
            certified: {
              id: certifiedAttributeId,
              assignmentTimestamp,
            },
          },
          {
            certifiedDiscrete: {
              id: certifiedDiscreteAttributeId,
              assignmentTimestamp,
              discreteValue: 42,
            },
          },
        ],
      }),
      id: tenantId,
      mails: [],
      features: [],
    };

    const registryCertifiedAttribute = {
      ...getMockedApiAttribute({
        kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
        name: "tenant certified",
        description: "tenant certified description",
      }),
      id: certifiedAttributeId,
    };
    const registryCertifiedDiscreteAttribute = {
      ...getMockedApiAttribute({
        kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE,
        name: "tenant certified discrete",
        description: "tenant certified discrete description",
      }),
      id: certifiedDiscreteAttributeId,
    };

    const tenantProcessClient = {
      tenant: {
        getTenant: vi.fn().mockResolvedValue(tenant),
      },
    };

    const attributeProcessClient = {
      getBulkedAttributes: vi.fn((attributeIds: string[]) =>
        Promise.resolve({
          results: [
            registryCertifiedAttribute,
            registryCertifiedDiscreteAttribute,
          ].filter((attribute) => attributeIds.includes(attribute.id)),
          totalCount: attributeIds.length,
        })
      ),
    };

    const service = tenantServiceBuilder(
      tenantProcessClient as never,
      attributeProcessClient as never,
      {} as never
    );

    const ctx = {
      authData: { organizationId: tenantId },
      headers: {
        "X-Correlation-Id": generateId(),
        Authorization: "authorization",
        "X-Forwarded-For": "x-forwarded-for",
      },
      logger: genericLogger,
    } as WithLogger<BffAppContext>;

    const result = await service.getTenant(tenantId, ctx);

    expect(result.attributes.certified).toStrictEqual([
      {
        id: certifiedAttributeId,
        name: registryCertifiedAttribute.name,
        description: registryCertifiedAttribute.description,
        assignmentTimestamp,
        revocationTimestamp: undefined,
      },
      {
        id: certifiedDiscreteAttributeId,
        name: registryCertifiedDiscreteAttribute.name,
        description: registryCertifiedDiscreteAttribute.description,
        assignmentTimestamp,
        revocationTimestamp: undefined,
        discreteValue: 42,
      },
    ]);
    expect(result.attributes).not.toHaveProperty("certifiedDiscrete");
    expect(attributeProcessClient.getBulkedAttributes).toHaveBeenCalledWith(
      expect.arrayContaining([
        certifiedAttributeId,
        certifiedDiscreteAttributeId,
      ]),
      expect.any(Object)
    );
  });
});
