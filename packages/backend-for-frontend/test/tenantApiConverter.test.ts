import { describe, it, expect } from "vitest";
import {
  attributeRegistryApi,
  bffApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  AttributeId,
  CertifiedDiscreteTenantAttribute,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  generateId,
  TenantId,
  tenantAttributeType,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";
import {
  RegistryAttributesMap,
  tenantAttributesFromApi,
  toBffApiCertifiedDiscreteTenantAttributes,
  toBffApiTenant,
} from "../src/api/tenantApiConverter.js";

function getApiAttributeRegistry(
  id: string,
  name: string,
  description = "desc",
  kind: attributeRegistryApi.AttributeKind = "CERTIFIED"
): attributeRegistryApi.Attribute {
  return {
    id,
    name,
    description,
    creationTime: new Date().toISOString(),
    kind,
  };
}

describe("tenantAttributesFromApi", () => {
  it("maps all four tenant attribute kinds (certified, declared, verified, certifiedDiscrete) to domain TenantAttribute", () => {
    const certifiedId = generateId<AttributeId>();
    const declaredId = generateId<AttributeId>();
    const verifiedId = generateId<AttributeId>();
    const certifiedDiscreteId = generateId<AttributeId>();
    const now = new Date().toISOString();

    const apiAttributes: tenantApi.Tenant["attributes"] = [
      {
        certified: {
          id: certifiedId,
          assignmentTimestamp: now,
        },
      },
      {
        declared: {
          id: declaredId,
          assignmentTimestamp: now,
        },
      },
      {
        verified: {
          id: verifiedId,
          assignmentTimestamp: now,
          verifiedBy: [],
          revokedBy: [],
        },
      },
      {
        certifiedDiscrete: {
          id: certifiedDiscreteId,
          assignmentTimestamp: now,
          discreteValue: 1234,
        },
      },
    ];

    const result = tenantAttributesFromApi(apiAttributes);

    expect(result).toHaveLength(4);

    const certified = result.find(
      (a) => a.type === tenantAttributeType.CERTIFIED
    ) as CertifiedTenantAttribute;
    expect(certified.id).toBe(certifiedId);

    const declared = result.find(
      (a) => a.type === tenantAttributeType.DECLARED
    ) as DeclaredTenantAttribute;
    expect(declared.id).toBe(declaredId);

    const verified = result.find(
      (a) => a.type === tenantAttributeType.VERIFIED
    ) as VerifiedTenantAttribute;
    expect(verified.id).toBe(verifiedId);

    const certifiedDiscrete = result.find(
      (a) => a.type === tenantAttributeType.CERTIFIED_DISCRETE
    ) as CertifiedDiscreteTenantAttribute;
    expect(certifiedDiscrete).toBeDefined();
    expect(certifiedDiscrete.id).toBe(certifiedDiscreteId);
    expect(certifiedDiscrete.discreteValue).toBe(1234);
    expect(certifiedDiscrete.revocationTimestamp).toBeUndefined();
  });

  it("preserves revocationTimestamp on certifiedDiscrete when provided", () => {
    const id = generateId<AttributeId>();
    const assignment = new Date("2026-01-01T00:00:00.000Z").toISOString();
    const revocation = new Date("2026-02-01T00:00:00.000Z").toISOString();

    const result = tenantAttributesFromApi([
      {
        certifiedDiscrete: {
          id,
          assignmentTimestamp: assignment,
          revocationTimestamp: revocation,
          discreteValue: 99,
        },
      },
    ]);

    expect(result).toHaveLength(1);
    const attr = result[0] as CertifiedDiscreteTenantAttribute;
    expect(attr.type).toBe(tenantAttributeType.CERTIFIED_DISCRETE);
    expect(attr.revocationTimestamp?.toISOString()).toBe(revocation);
    expect(attr.discreteValue).toBe(99);
  });
});

describe("toBffApiCertifiedDiscreteTenantAttributes", () => {
  it("returns only attributes that have a matching registry entry", () => {
    const matchedId = generateId<AttributeId>();
    const unmatchedId = generateId<AttributeId>();
    const now = new Date().toISOString();

    const registryMap: RegistryAttributesMap = new Map([
      [matchedId, getApiAttributeRegistry(matchedId, "Population")],
    ]);

    const attributes: tenantApi.CertifiedDiscreteTenantAttribute[] = [
      { id: matchedId, assignmentTimestamp: now, discreteValue: 10 },
      { id: unmatchedId, assignmentTimestamp: now, discreteValue: 20 },
    ];

    const result = toBffApiCertifiedDiscreteTenantAttributes(
      attributes,
      registryMap
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: matchedId,
      name: "Population",
      description: "desc",
      discreteValue: 10,
    });
  });

  it("returns an empty array when no certified discrete attributes are passed", () => {
    expect(
      toBffApiCertifiedDiscreteTenantAttributes([], new Map())
    ).toStrictEqual([]);
  });
});

describe("toBffApiTenant", () => {
  it("exposes certifiedDiscrete attributes alongside the other kinds in the BFF response", () => {
    const certifiedId = generateId<AttributeId>();
    const declaredId = generateId<AttributeId>();
    const verifiedId = generateId<AttributeId>();
    const certifiedDiscreteId = generateId<AttributeId>();
    const tenantId = generateId<TenantId>();
    const now = new Date().toISOString();

    const tenant: tenantApi.Tenant = {
      id: tenantId,
      selfcareId: generateId(),
      externalId: { value: generateId(), origin: "IPA" },
      features: [],
      createdAt: now,
      name: "tenant",
      attributes: [
        {
          certifiedDiscrete: {
            id: certifiedDiscreteId,
            assignmentTimestamp: now,
            discreteValue: 5000,
          },
        },
      ],
      mails: [],
    };

    const certifiedAttributes: tenantApi.CertifiedTenantAttribute[] = [
      { id: certifiedId, assignmentTimestamp: now },
    ];
    const declaredAttributes: tenantApi.DeclaredTenantAttribute[] = [
      { id: declaredId, assignmentTimestamp: now },
    ];
    const verifiedAttributes: tenantApi.VerifiedTenantAttribute[] = [
      {
        id: verifiedId,
        assignmentTimestamp: now,
        verifiedBy: [],
        revokedBy: [],
      },
    ];

    const registryMap: RegistryAttributesMap = new Map([
      [certifiedId, getApiAttributeRegistry(certifiedId, "Certified")],
      [
        declaredId,
        getApiAttributeRegistry(declaredId, "Declared", "desc", "DECLARED"),
      ],
      [
        verifiedId,
        getApiAttributeRegistry(verifiedId, "Verified", "desc", "VERIFIED"),
      ],
      [
        certifiedDiscreteId,
        getApiAttributeRegistry(
          certifiedDiscreteId,
          "CertifiedDiscrete",
          "desc",
          "CERTIFIED_DISCRETE"
        ),
      ],
    ]);

    const result: bffApi.Tenant = toBffApiTenant(
      tenant,
      certifiedAttributes,
      declaredAttributes,
      verifiedAttributes,
      registryMap
    );

    expect(result.id).toBe(tenantId);
    expect(result.attributes.certified).toHaveLength(1);
    expect(result.attributes.declared).toHaveLength(1);
    expect(result.attributes.verified).toHaveLength(1);
    expect(result.attributes.certifiedDiscrete).toHaveLength(1);
    expect(result.attributes.certifiedDiscrete[0]).toMatchObject({
      id: certifiedDiscreteId,
      name: "CertifiedDiscrete",
      discreteValue: 5000,
    });
  });

  it("returns an empty certifiedDiscrete array when the tenant has none", () => {
    const tenantId = generateId<TenantId>();
    const now = new Date().toISOString();

    const tenant: tenantApi.Tenant = {
      id: tenantId,
      selfcareId: generateId(),
      externalId: { value: generateId(), origin: "IPA" },
      features: [],
      createdAt: now,
      name: "tenant",
      attributes: [],
      mails: [],
    };

    const result = toBffApiTenant(tenant, [], [], [], new Map());

    expect(result.attributes.certifiedDiscrete).toStrictEqual([]);
  });
});
