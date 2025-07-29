import { beforeEach, describe, expect, it } from "vitest";
import {
  Tenant,
  generateId,
  TenantId,
  AttributeId,
  VerifiedTenantAttribute,
  tenantAttributeType,
  TenantRevoker,
} from "pagopa-interop-models";
import { getMockContext, getMockTenant } from "pagopa-interop-commons-test";
import { addOneTenant, tenantService } from "../integrationUtils.js";
import {
  getMockVerifiedTenantAttribute,
  getMockCertifiedTenantAttribute,
} from "../mockUtils.js";

describe("getTenantVerifiedAttributeRevokers", () => {
  const tenantId: TenantId = generateId();
  const attributeId: AttributeId = generateId();
  const revoker1Id: TenantId = generateId();
  const revoker2Id: TenantId = generateId();

  const revoker1: TenantRevoker = {
    id: revoker1Id,
    verificationDate: new Date("2024-01-01T10:00:00Z"),
    revocationDate: new Date("2024-06-01T10:00:00Z"),
    expirationDate: undefined,
    extensionDate: undefined,
  };

  const revoker2: TenantRevoker = {
    id: revoker2Id,
    verificationDate: new Date("2024-02-01T10:00:00Z"),
    revocationDate: new Date("2024-07-01T10:00:00Z"),
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
      id: revoker1Id,
    });
    await addOneTenant({
      ...getMockTenant(),
      id: revoker2Id,
    });
  });

  it("should retrieve revokers for a verified attribute", async () => {
    const tenantWithRevokers: Tenant = {
      ...getMockTenant(),
      id: tenantId,
      attributes: [
        {
          ...getMockVerifiedTenantAttribute(),
          id: attributeId,
          assignmentTimestamp: new Date("2024-01-01"),
          verifiedBy: [],
          revokedBy: [revoker1, revoker2],
        },
      ],
    };

    await addOneTenant(tenantWithRevokers);

    const result = await tenantService.getTenantVerifiedAttributeRevokers(
      tenantId,
      attributeId,
      { offset: 0, limit: 10 },
      getMockContext({})
    );

    expect(result.results).toHaveLength(2);
    expect(result.totalCount).toBe(2);

    expect(result.results[0]).toEqual({
      id: revoker1Id,
      verificationDate: revoker1.verificationDate.toISOString(),
      revocationDate: revoker1.revocationDate.toISOString(),
    });

    expect(result.results[1]).toEqual({
      id: revoker2Id,
      verificationDate: revoker2.verificationDate.toISOString(),
      revocationDate: revoker2.revocationDate.toISOString(),
    });
  });

  it("should handle pagination correctly", async () => {
    const tenantWithRevokers: Tenant = {
      ...getMockTenant(),
      id: tenantId,
      attributes: [
        {
          ...getMockVerifiedTenantAttribute(),
          id: attributeId,
          assignmentTimestamp: new Date("2024-01-01"),
          verifiedBy: [],
          revokedBy: [revoker1, revoker2],
        },
      ],
    };

    await addOneTenant(tenantWithRevokers);

    const firstPage = await tenantService.getTenantVerifiedAttributeRevokers(
      tenantId,
      attributeId,
      { offset: 0, limit: 1 },
      getMockContext({})
    );

    expect(firstPage.results).toHaveLength(1);
    expect(firstPage.totalCount).toBe(2);

    const secondPage = await tenantService.getTenantVerifiedAttributeRevokers(
      tenantId,
      attributeId,
      { offset: 1, limit: 1 },
      getMockContext({})
    );

    expect(secondPage.results).toHaveLength(1);
    expect(secondPage.totalCount).toBe(2);
    expect(secondPage.results[0].id).toBe(revoker2Id);
  });

  it("should return empty results when tenant does not exist", async () => {
    const nonExistentTenantId: TenantId = generateId();

    const result = await tenantService.getTenantVerifiedAttributeRevokers(
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

    const result = await tenantService.getTenantVerifiedAttributeRevokers(
      tenantId,
      nonExistentAttributeId,
      { offset: 0, limit: 10 },
      getMockContext({})
    );

    expect(result.results).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it("should return empty results when attribute has no revokers", async () => {
    const attributeWithoutRevokers: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      id: generateId(),
      assignmentTimestamp: new Date("2024-01-01"),
      verifiedBy: [],
      revokedBy: [],
    };

    const tenantWithoutRevokers: Tenant = {
      ...getMockTenant(),
      id: generateId(),
      attributes: [attributeWithoutRevokers],
    };

    await addOneTenant(tenantWithoutRevokers);

    const result = await tenantService.getTenantVerifiedAttributeRevokers(
      tenantWithoutRevokers.id,
      attributeWithoutRevokers.id,
      { offset: 0, limit: 10 },
      getMockContext({})
    );

    expect(result.results).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it("should only return revokers for verified attributes, not certified or declared", async () => {
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
          verifiedBy: [],
          revokedBy: [revoker1, revoker2],
        },
      ],
    };

    await addOneTenant(tenantWithMixedAttributes);

    // Should return empty for certified attribute
    const certifiedResult =
      await tenantService.getTenantVerifiedAttributeRevokers(
        tenantWithMixedAttributes.id,
        certifiedAttributeId,
        { offset: 0, limit: 10 },
        getMockContext({})
      );
    expect(certifiedResult.results).toHaveLength(0);

    // Should return empty for declared attribute
    const declaredResult =
      await tenantService.getTenantVerifiedAttributeRevokers(
        tenantWithMixedAttributes.id,
        declaredAttributeId,
        { offset: 0, limit: 10 },
        getMockContext({})
      );
    expect(declaredResult.results).toHaveLength(0);

    // Should return revokers for verified attribute
    const verifiedResult =
      await tenantService.getTenantVerifiedAttributeRevokers(
        tenantWithMixedAttributes.id,
        attributeId,
        { offset: 0, limit: 10 },
        getMockContext({})
      );
    expect(verifiedResult.results).toHaveLength(2);
  });
});
