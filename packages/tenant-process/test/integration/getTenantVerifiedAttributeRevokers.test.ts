/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  Tenant,
  TenantRevoker,
  generateId,
  TenantId,
  AttributeId,
  VerifiedTenantAttribute,
  tenantAttributeType,
  DelegationId,
} from "pagopa-interop-models";
import { getMockContext, getMockTenant } from "pagopa-interop-commons-test";
import { addOneTenant, tenantService } from "../integrationUtils.js";

describe("getTenantVerifiedAttributeRevokers", () => {
  const tenantId: TenantId = generateId();
  const attributeId: AttributeId = generateId();
  const revoker1Id: TenantId = generateId();
  const revoker2Id: TenantId = generateId();
  const delegationId: DelegationId = generateId();

  const revoker1: TenantRevoker = {
    id: revoker1Id,
    verificationDate: new Date("2024-01-01"),
    expirationDate: new Date("2025-01-01"),
    extensionDate: new Date("2025-06-01"),
    revocationDate: new Date("2024-06-01"),
    delegationId,
  };

  const revoker2: TenantRevoker = {
    id: revoker2Id,
    verificationDate: new Date("2024-02-01"),
    expirationDate: new Date("2025-02-01"),
    extensionDate: undefined,
    revocationDate: new Date("2024-07-01"),
    delegationId: undefined,
  };

  const verifiedAttribute: VerifiedTenantAttribute = {
    type: tenantAttributeType.VERIFIED,
    id: attributeId,
    assignmentTimestamp: new Date("2024-01-01"),
    verifiedBy: [],
    revokedBy: [revoker1, revoker2],
  };

  const tenant: Tenant = {
    ...getMockTenant(),
    id: tenantId,
    attributes: [verifiedAttribute],
  };

  it("should retrieve revokers for a verified attribute", async () => {
    await addOneTenant(tenant);

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
      expirationDate: revoker1.expirationDate?.toISOString(),
      extensionDate: revoker1.extensionDate?.toISOString(),
      revocationDate: revoker1.revocationDate.toISOString(),
      delegationId: revoker1.delegationId,
    });

    expect(result.results[1]).toEqual({
      id: revoker2Id,
      verificationDate: revoker2.verificationDate.toISOString(),
      expirationDate: revoker2.expirationDate?.toISOString(),
      extensionDate: revoker2.extensionDate,
      revocationDate: revoker2.revocationDate.toISOString(),
      delegationId: revoker2.delegationId,
    });
  });

  it("should handle pagination correctly", async () => {
    await addOneTenant(tenant);

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
      type: tenantAttributeType.VERIFIED,
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
          type: tenantAttributeType.CERTIFIED,
          id: certifiedAttributeId,
          assignmentTimestamp: new Date("2024-01-01"),
          revocationTimestamp: undefined,
        },
        {
          type: tenantAttributeType.DECLARED,
          id: declaredAttributeId,
          assignmentTimestamp: new Date("2024-01-01"),
          revocationTimestamp: undefined,
        },
        verifiedAttribute,
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
