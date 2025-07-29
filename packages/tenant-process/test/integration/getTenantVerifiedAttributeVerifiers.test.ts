import { beforeEach, describe, expect, it } from "vitest";
import {
  Tenant,
  generateId,
  TenantId,
  AttributeId,
  VerifiedTenantAttribute,
  tenantAttributeType,
  TenantVerifier,
} from "pagopa-interop-models";
import { getMockContext, getMockTenant } from "pagopa-interop-commons-test";
import { addOneTenant, tenantService } from "../integrationUtils.js";
import {
  getMockVerifiedTenantAttribute,
  getMockCertifiedTenantAttribute,
} from "../mockUtils.js";

describe("getTenantVerifiedAttributeVerifiers", () => {
  const tenantId: TenantId = generateId();
  const attributeId: AttributeId = generateId();
  const verifier1Id: TenantId = generateId();
  const verifier2Id: TenantId = generateId();

  const verifier1: TenantVerifier = {
    id: verifier1Id,
    verificationDate: new Date("2024-01-01T10:00:00Z"),
    expirationDate: undefined,
    extensionDate: undefined,
  };

  const verifier2: TenantVerifier = {
    id: verifier2Id,
    verificationDate: new Date("2024-01-02T10:00:00Z"),
    expirationDate: undefined,
    extensionDate: undefined,
  };

  const verifiedAttribute: VerifiedTenantAttribute = {
    ...getMockVerifiedTenantAttribute(),
    id: attributeId,
    assignmentTimestamp: new Date("2024-01-01"),
    verifiedBy: [],
    revokedBy: [],
  };

  const tenant: Tenant = {
    ...getMockTenant(),
    id: tenantId,
    attributes: [verifiedAttribute],
  };

  beforeEach(async () => {
    await addOneTenant({
      ...getMockTenant(),
      id: verifier1Id,
    });
    await addOneTenant({
      ...getMockTenant(),
      id: verifier2Id,
    });
  });
  it("should retrieve verifiers for a verified attribute", async () => {
    const tenantWithVerifiers: Tenant = {
      ...getMockTenant(),
      id: tenantId,
      attributes: [
        {
          ...getMockVerifiedTenantAttribute(),
          id: attributeId,
          assignmentTimestamp: new Date("2024-01-01"),
          verifiedBy: [verifier1, verifier2],
          revokedBy: [],
        },
      ],
    };

    await addOneTenant(tenantWithVerifiers);

    const result = await tenantService.getTenantVerifiedAttributeVerifiers(
      tenantId,
      attributeId,
      { offset: 0, limit: 10 },
      getMockContext({})
    );

    expect(result.results).toHaveLength(2);
    expect(result.totalCount).toBe(2);

    expect(result.results[0]).toEqual({
      id: verifier1Id,
      verificationDate: verifier1.verificationDate.toISOString(),
    });

    expect(result.results[1]).toEqual({
      id: verifier2Id,
      verificationDate: verifier2.verificationDate.toISOString(),
    });
  });

  it("should handle pagination correctly", async () => {
    const tenantWithVerifiers: Tenant = {
      ...getMockTenant(),
      id: tenantId,
      attributes: [
        {
          ...getMockVerifiedTenantAttribute(),
          id: attributeId,
          assignmentTimestamp: new Date("2024-01-01"),
          verifiedBy: [verifier1, verifier2],
          revokedBy: [],
        },
      ],
    };

    await addOneTenant(tenantWithVerifiers);

    const firstPage = await tenantService.getTenantVerifiedAttributeVerifiers(
      tenantId,
      attributeId,
      { offset: 0, limit: 1 },
      getMockContext({})
    );

    expect(firstPage.results).toHaveLength(1);
    expect(firstPage.totalCount).toBe(2);

    const secondPage = await tenantService.getTenantVerifiedAttributeVerifiers(
      tenantId,
      attributeId,
      { offset: 1, limit: 1 },
      getMockContext({})
    );

    expect(secondPage.results).toHaveLength(1);
    expect(secondPage.totalCount).toBe(2);
    expect(secondPage.results[0].id).toBe(verifier2Id);
  });

  it("should return empty results when tenant does not exist", async () => {
    const nonExistentTenantId: TenantId = generateId();

    const result = await tenantService.getTenantVerifiedAttributeVerifiers(
      nonExistentTenantId,
      attributeId,
      { offset: 0, limit: 10 },
      getMockContext({})
    );

    expect(result.results).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it("should return empty results when attribute does not exist", async () => {
    await addOneTenant(tenant);
    const nonExistentAttributeId: AttributeId = generateId();

    const result = await tenantService.getTenantVerifiedAttributeVerifiers(
      tenantId,
      nonExistentAttributeId,
      { offset: 0, limit: 10 },
      getMockContext({})
    );

    expect(result.results).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it("should return empty results when attribute has no verifiers", async () => {
    const attributeWithoutVerifiers: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      id: generateId(),
      assignmentTimestamp: new Date("2024-01-01"),
      verifiedBy: [],
      revokedBy: [],
    };

    const tenantWithoutVerifiers: Tenant = {
      ...getMockTenant(),
      id: generateId(),
      attributes: [attributeWithoutVerifiers],
    };

    await addOneTenant(tenantWithoutVerifiers);

    const result = await tenantService.getTenantVerifiedAttributeVerifiers(
      tenantWithoutVerifiers.id,
      attributeWithoutVerifiers.id,
      { offset: 0, limit: 10 },
      getMockContext({})
    );

    expect(result.results).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it("should only return verifiers for verified attributes, not certified or declared", async () => {
    const certifiedAttributeId: AttributeId = generateId();
    const declaredAttributeId: AttributeId = generateId();

    const tenantWithMixedAttributes: Tenant = {
      ...getMockTenant(),
      id: generateId(),
      attributes: [
        {
          ...getMockCertifiedTenantAttribute(),
          id: certifiedAttributeId,
        },
        {
          type: tenantAttributeType.DECLARED,
          id: declaredAttributeId,
          assignmentTimestamp: new Date("2024-01-01"),
          revocationTimestamp: undefined,
        },
        {
          ...getMockVerifiedTenantAttribute(),
          id: attributeId,
          assignmentTimestamp: new Date("2024-01-01"),
          verifiedBy: [verifier1, verifier2],
          revokedBy: [],
        },
      ],
    };

    await addOneTenant(tenantWithMixedAttributes);

    // Should return empty for certified attribute
    const certifiedResult =
      await tenantService.getTenantVerifiedAttributeVerifiers(
        tenantWithMixedAttributes.id,
        certifiedAttributeId,
        { offset: 0, limit: 10 },
        getMockContext({})
      );
    expect(certifiedResult.results).toHaveLength(0);

    // Should return empty for declared attribute
    const declaredResult =
      await tenantService.getTenantVerifiedAttributeVerifiers(
        tenantWithMixedAttributes.id,
        declaredAttributeId,
        { offset: 0, limit: 10 },
        getMockContext({})
      );
    expect(declaredResult.results).toHaveLength(0);

    // Should return verifiers for verified attribute
    const verifiedResult =
      await tenantService.getTenantVerifiedAttributeVerifiers(
        tenantWithMixedAttributes.id,
        attributeId,
        { offset: 0, limit: 10 },
        getMockContext({})
      );
    expect(verifiedResult.results).toHaveLength(2);
  });
});
