/* eslint-disable @typescript-eslint/no-floating-promises */
import { getMockContext, getMockTenant } from "pagopa-interop-commons-test";
import {
  Tenant,
  generateId,
  TenantId,
  AttributeId,
  DelegationId,
  DeclaredTenantAttribute,
  CertifiedTenantAttribute,
  VerifiedTenantAttribute,
  TenantVerifier,
  tenantAttributeType,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { tenantNotFound } from "../../src/model/domain/errors.js";
import { addOneTenant, tenantService } from "../integrationUtils.js";
import {
  getMockCertifiedTenantAttribute,
  getMockVerifiedTenantAttribute,
} from "../mockUtils.js";

describe("get tenant attributes", () => {
  const tenantId: TenantId = generateId();
  const delegationId: DelegationId = generateId();

  const declaredWithDelegation: DeclaredTenantAttribute = {
    id: generateId<AttributeId>(),
    type: tenantAttributeType.DECLARED,
    assignmentTimestamp: new Date("2024-01-01T00:00:00Z"),
    delegationId,
  };
  const declaredWithoutDelegation: DeclaredTenantAttribute = {
    id: generateId<AttributeId>(),
    type: tenantAttributeType.DECLARED,
    assignmentTimestamp: new Date("2024-01-02T00:00:00Z"),
  };

  const certified1: CertifiedTenantAttribute = {
    ...getMockCertifiedTenantAttribute(),
    id: generateId<AttributeId>(),
    assignmentTimestamp: new Date("2024-01-01T00:00:00Z"),
  };
  const certified2: CertifiedTenantAttribute = {
    ...getMockCertifiedTenantAttribute(),
    id: generateId<AttributeId>(),
    assignmentTimestamp: new Date("2024-01-02T00:00:00Z"),
  };

  const verifier: TenantVerifier = {
    id: generateId<TenantId>(),
    verificationDate: new Date("2024-01-01T10:00:00Z"),
    expirationDate: undefined,
    extensionDate: undefined,
  };
  const verifiedAttribute: VerifiedTenantAttribute = {
    ...getMockVerifiedTenantAttribute(),
    id: generateId<AttributeId>(),
    assignmentTimestamp: new Date("2024-01-01T00:00:00Z"),
    verifiedBy: [verifier],
    revokedBy: [],
  };

  const tenant: Tenant = {
    ...getMockTenant(),
    id: tenantId,
    attributes: [
      declaredWithDelegation,
      declaredWithoutDelegation,
      certified1,
      certified2,
      verifiedAttribute,
    ],
  };

  it("getTenantDeclaredAttributes should return the declared attributes with pagination", async () => {
    await addOneTenant(tenant);

    const result = await tenantService.getTenantDeclaredAttributes(
      tenantId,
      { offset: 0, limit: 10 },
      getMockContext({})
    );

    expect(result.totalCount).toBe(2);
    expect(new Set(result.results.map((a) => a.id))).toEqual(
      new Set([declaredWithDelegation.id, declaredWithoutDelegation.id])
    );
  });

  it("getTenantDeclaredAttributes should filter by delegationId", async () => {
    await addOneTenant(tenant);

    const result = await tenantService.getTenantDeclaredAttributes(
      tenantId,
      { delegationId, offset: 0, limit: 10 },
      getMockContext({})
    );

    expect(result.totalCount).toBe(1);
    expect(result.results.map((a) => a.id)).toEqual([
      declaredWithDelegation.id,
    ]);
  });

  it("getTenantCertifiedAttributes should return the certified attributes with pagination", async () => {
    await addOneTenant(tenant);

    const page1 = await tenantService.getTenantCertifiedAttributes(
      tenantId,
      { offset: 0, limit: 1 },
      getMockContext({})
    );
    expect(page1.totalCount).toBe(2);
    expect(page1.results).toHaveLength(1);

    const all = await tenantService.getTenantCertifiedAttributes(
      tenantId,
      { offset: 0, limit: 10 },
      getMockContext({})
    );
    expect(new Set(all.results.map((a) => a.id))).toEqual(
      new Set([certified1.id, certified2.id])
    );
  });

  it("getTenantVerifiedAttributes should return the verified attributes including verifiers", async () => {
    await addOneTenant(tenant);

    const result = await tenantService.getTenantVerifiedAttributes(
      tenantId,
      { offset: 0, limit: 10 },
      getMockContext({})
    );

    expect(result.totalCount).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe(verifiedAttribute.id);
    expect(result.results[0].verifiedBy.map((v) => v.id)).toEqual([
      verifier.id,
    ]);
    expect(result.results[0].revokedBy).toEqual([]);
  });

  it("should throw tenantNotFound when the tenant does not exist", async () => {
    const notExistingTenantId: TenantId = generateId();

    await expect(
      tenantService.getTenantDeclaredAttributes(
        notExistingTenantId,
        { offset: 0, limit: 10 },
        getMockContext({})
      )
    ).rejects.toThrowError(tenantNotFound(notExistingTenantId));

    await expect(
      tenantService.getTenantCertifiedAttributes(
        notExistingTenantId,
        { offset: 0, limit: 10 },
        getMockContext({})
      )
    ).rejects.toThrowError(tenantNotFound(notExistingTenantId));

    await expect(
      tenantService.getTenantVerifiedAttributes(
        notExistingTenantId,
        { offset: 0, limit: 10 },
        getMockContext({})
      )
    ).rejects.toThrowError(tenantNotFound(notExistingTenantId));
  });
});
