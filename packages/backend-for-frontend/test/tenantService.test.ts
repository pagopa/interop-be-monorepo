import {
  attributeRegistryApi,
  bffApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { genericLogger, WithLogger } from "pagopa-interop-commons";
import {
  getMockedApiAttribute,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { AttributeId, TenantId, generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import {
  tenantAttributeKind,
  toBffApiRequesterCertifiedAttributes,
} from "../src/api/tenantApiConverter.js";
import { tenantServiceBuilder } from "../src/services/tenantService.js";
import { BffAppContext } from "../src/utilities/context.js";

describe("tenantServiceBuilder.getTenant", () => {
  it("should merge certified and certified discrete attributes into the certified attributes", async () => {
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

    const registryCertifiedAttribute: attributeRegistryApi.Attribute = {
      ...getMockedApiAttribute({
        kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
        name: "tenant certified",
        description: "tenant certified description",
      }),
      id: certifiedAttributeId,
    };
    const registryCertifiedDiscreteAttribute: attributeRegistryApi.Attribute = {
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
        kind: tenantAttributeKind.certified,
        id: certifiedAttributeId,
        name: registryCertifiedAttribute.name,
        description: registryCertifiedAttribute.description,
        assignmentTimestamp,
        revocationTimestamp: undefined,
      },
      {
        kind: tenantAttributeKind.certifiedDiscrete,
        id: certifiedDiscreteAttributeId,
        name: registryCertifiedDiscreteAttribute.name,
        description: registryCertifiedDiscreteAttribute.description,
        assignmentTimestamp,
        revocationTimestamp: undefined,
        discreteValue: 42,
      },
    ]);
    expect(result.attributes).not.toHaveProperty("certifiedDiscrete");
  });

  it("should set the DECLARED kind discriminator on declared attributes", async () => {
    const tenantId = generateId<TenantId>();
    const declaredAttributeId = generateId<AttributeId>();
    const assignmentTimestamp = new Date().toISOString();

    const tenant: tenantApi.Tenant = {
      ...getMockedApiTenant({
        attributes: [
          {
            declared: {
              id: declaredAttributeId,
              assignmentTimestamp,
            },
          },
        ],
      }),
      id: tenantId,
      mails: [],
      features: [],
    };

    const registryDeclaredAttribute: attributeRegistryApi.Attribute = {
      ...getMockedApiAttribute({
        kind: attributeRegistryApi.AttributeKind.Values.DECLARED,
        name: "tenant declared",
        description: "tenant declared description",
      }),
      id: declaredAttributeId,
    };

    const tenantProcessClient = {
      tenant: {
        getTenant: vi.fn().mockResolvedValue(tenant),
      },
    };

    const attributeProcessClient = {
      getBulkedAttributes: vi.fn((attributeIds: string[]) =>
        Promise.resolve({
          results: [registryDeclaredAttribute].filter((attribute) =>
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

    expect(result.attributes.declared).toStrictEqual([
      {
        kind: tenantAttributeKind.declared,
        id: declaredAttributeId,
        name: registryDeclaredAttribute.name,
        description: registryDeclaredAttribute.description,
        assignmentTimestamp,
        revocationTimestamp: undefined,
        delegationId: undefined,
      },
    ]);
  });

  it("should set the VERIFIED kind discriminator on verified attributes", async () => {
    const tenantId = generateId<TenantId>();
    const verifiedAttributeId = generateId<AttributeId>();
    const assignmentTimestamp = new Date().toISOString();

    const tenant: tenantApi.Tenant = {
      ...getMockedApiTenant({
        attributes: [
          {
            verified: {
              id: verifiedAttributeId,
              assignmentTimestamp,
              verifiedBy: [],
              revokedBy: [],
            },
          },
        ],
      }),
      id: tenantId,
      mails: [],
      features: [],
    };

    const registryVerifiedAttribute: attributeRegistryApi.Attribute = {
      ...getMockedApiAttribute({
        kind: attributeRegistryApi.AttributeKind.Values.VERIFIED,
        name: "tenant verified",
        description: "tenant verified description",
      }),
      id: verifiedAttributeId,
    };

    const tenantProcessClient = {
      tenant: {
        getTenant: vi.fn().mockResolvedValue(tenant),
      },
    };

    const attributeProcessClient = {
      getBulkedAttributes: vi.fn((attributeIds: string[]) =>
        Promise.resolve({
          results: [registryVerifiedAttribute].filter((attribute) =>
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

    expect(result.attributes.verified).toStrictEqual([
      {
        kind: tenantAttributeKind.verified,
        id: verifiedAttributeId,
        name: registryVerifiedAttribute.name,
        description: registryVerifiedAttribute.description,
        assignmentTimestamp,
        verifiedBy: [],
        revokedBy: [],
      },
    ]);
  });
});

describe("tenantServiceBuilder.getCertifiedAttributes", () => {
  it("should return certified and certified discrete attributes with their kind discriminator", async () => {
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

    const registryCertifiedAttribute: attributeRegistryApi.Attribute = {
      ...getMockedApiAttribute({
        kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
      }),
      id: certifiedAttributeId,
    };
    const registryCertifiedDiscreteAttribute: attributeRegistryApi.Attribute = {
      ...getMockedApiAttribute({
        kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE,
      }),
      id: certifiedDiscreteAttributeId,
    };

    const service = tenantServiceBuilder(
      {
        tenant: {
          getTenant: vi.fn().mockResolvedValue(tenant),
        },
      } as never,
      {
        getBulkedAttributes: vi.fn().mockResolvedValue({
          results: [
            registryCertifiedAttribute,
            registryCertifiedDiscreteAttribute,
          ],
          totalCount: 2,
        }),
      } as never,
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

    const result = await service.getCertifiedAttributes(tenantId, ctx);
    bffApi.CertifiedAttributesResponse.parse(result);

    expect(result.attributes).toStrictEqual([
      expect.objectContaining({
        id: certifiedAttributeId,
        kind: tenantAttributeKind.certified,
      }),
      expect.objectContaining({
        id: certifiedDiscreteAttributeId,
        kind: tenantAttributeKind.certifiedDiscrete,
        discreteValue: 42,
      }),
    ]);
  });
});

describe("toBffApiRequesterCertifiedAttributes", () => {
  const testCases: Array<{
    inputKind: tenantApi.CertifiedAttributeKind;
    expectedKind: bffApi.RequesterCertifiedAttribute["kind"];
  }> = [
    {
      inputKind: "CERTIFIED",
      expectedKind: tenantAttributeKind.certified,
    },
    {
      inputKind: "CERTIFIED_DISCRETE",
      expectedKind: tenantAttributeKind.certifiedDiscrete,
    },
  ];

  it.each(testCases)(
    "should preserve the $inputKind discriminator",
    ({ inputKind, expectedKind }) => {
      const input: tenantApi.CertifiedAttribute = {
        id: generateId(),
        name: "tenant",
        attributeId: generateId(),
        attributeName: "attribute",
        kind: inputKind,
      };

      const result: bffApi.RequesterCertifiedAttribute =
        toBffApiRequesterCertifiedAttributes(input);
      bffApi.RequesterCertifiedAttribute.parse(result);

      expect(result).toStrictEqual({
        tenantId: input.id,
        tenantName: input.name,
        attributeId: input.attributeId,
        attributeName: input.attributeName,
        kind: expectedKind,
      });
    }
  );
});
