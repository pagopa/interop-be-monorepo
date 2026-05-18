import { genericLogger, WithLogger } from "pagopa-interop-commons";
import {
  getMockedApiAttribute,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { AttributeId, TenantId, generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { tenantServiceBuilder } from "../src/services/tenantService.js";
import { BffAppContext } from "../src/utilities/context.js";

describe("tenantServiceBuilder.getTenant", () => {
  it("should include certified discrete attributes in tenant details", async () => {
    const tenantId = generateId<TenantId>();
    const certifiedDiscreteAttributeId = generateId<AttributeId>();
    const assignmentTimestamp = new Date().toISOString();

    const tenant = {
      ...getMockedApiTenant({
        attributes: [
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

    const registryAttribute = {
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
          results: [registryAttribute].filter((attribute) =>
            attributeIds.includes(attribute.id)
          ),
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

    expect(result.attributes.certifiedDiscrete).toStrictEqual([
      {
        id: certifiedDiscreteAttributeId,
        name: registryAttribute.name,
        description: registryAttribute.description,
        assignmentTimestamp,
        revocationTimestamp: undefined,
        discreteValue: 42,
      },
    ]);
    expect(attributeProcessClient.getBulkedAttributes).toHaveBeenCalledWith(
      expect.arrayContaining([certifiedDiscreteAttributeId]),
      expect.any(Object)
    );
  });
});
