import { features } from "process";
import { Attribute, Tenant, TenantAttribute } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockAttribute,
  getMockCertifiedTenantAttribute,
} from "pagopa-interop-commons-test";
import {
  addOneAttribute,
  addOneTenant,
  tenantService,
  getMockTenant,
} from "./utils.js";

describe("getCertifiedAttributes", () => {
  const tenantCertifier = {
    ...getMockTenant(),
    features: [{ type: "PersistentCertifier", certifierId: "cert" }],
  };
  const tenant2 = getMockTenant();

  it.only("should get certified attributes certified by the passed certifier id", async () => {
    const tenantCertifiedAttribute1: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const tenantCertifiedAttribute2: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const certifiedAttribute1: Attribute = {
      ...getMockAttribute(),
      id: tenantCertifiedAttribute1.id,
      origin: tenantCertifier.id,
    };

    const certifiedAttribute2: Attribute = {
      ...getMockAttribute(),
      id: tenantCertifiedAttribute2.id,
      origin: tenantCertifier.id,
    };

    await addOneAttribute(certifiedAttribute1);
    await addOneAttribute(certifiedAttribute2);

    const tenantWithCertifiedAttributes: Tenant = {
      ...tenant2,
      attributes: [
        {
          id: certifiedAttribute1.id,
          type: "PersistentCertifiedAttribute",
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
        {
          id: certifiedAttribute2.id,
          type: "PersistentCertifiedAttribute",
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };

    await addOneTenant(tenantCertifier);
    await addOneTenant(tenantWithCertifiedAttributes);

    const result = await tenantService.getCertifiedAttributes({
      organizationId: tenantCertifier.id,
      offset: 0,
      limit: 50,
    });

    expect(result.results).toEqual([
      {
        id: tenant2.id,
        name: tenant2.name,
        attributeId: tenantCertifiedAttribute1.id,
        attributeName: certifiedAttribute1.name,
      },
      {
        id: tenant2.id,
        name: tenant2.name,
        attributeId: tenantCertifiedAttribute2.id,
        attributeName: certifiedAttribute1.name,
      },
    ]);
    expect(result.totalCount).toBe(2);
  });

  it("should not return the attributes when they are revoked", async () => {
    const tenantCertifiedAttribute: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const revokedAttribute: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const readModelCertifiedAttribute: Attribute = {
      ...getMockAttribute(),
      id: tenantCertifiedAttribute.id,
      origin: tenant1.id,
    };

    const readModelRevokedCertifiedAttribute: Attribute = {
      ...getMockAttribute(),
      id: revokedAttribute.id,
      origin: tenant1.id,
    };

    await addOneAttribute(readModelCertifiedAttribute);
    await addOneAttribute(readModelRevokedCertifiedAttribute);

    const tenantWithCertifiedAttributes: Tenant = {
      ...tenant2,
      attributes: [
        ...tenant2.attributes,
        tenantCertifiedAttribute,
        revokedAttribute,
      ],
    };

    await addOneTenant(tenantWithCertifiedAttributes);

    const result = await tenantService.getCertifiedAttributes({
      organizationId: tenant1.id,
      offset: 0,
      limit: 50,
    });

    expect(result.results).not.toContainEqual({
      id: tenant2.id,
      name: tenant2.name,
      attributeId: revokedAttribute.id,
      attributeName: readModelRevokedCertifiedAttribute.name,
    });
  });

  it("should correctly manage pagination params (offset, limit)", async () => {
    const tenantCertifiedAttribute1: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const tenantCertifiedAttribute2: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const readModelCertifiedAttribute1: Attribute = {
      ...getMockAttribute(),
      id: tenantCertifiedAttribute1.id,
      origin: tenant1.id,
    };

    const readModelCertifiedAttribute2: Attribute = {
      ...getMockAttribute(),
      id: tenantCertifiedAttribute2.id,
      origin: tenant1.id,
    };

    await addOneAttribute(readModelCertifiedAttribute1);
    await addOneAttribute(readModelCertifiedAttribute2);

    const tenantWithCertifiedAttributes: Tenant = {
      ...tenant2,
      attributes: [
        ...tenant2.attributes,
        tenantCertifiedAttribute1,
        tenantCertifiedAttribute2,
      ],
    };

    await addOneTenant(tenantWithCertifiedAttributes);

    const { results } = await tenantService.getCertifiedAttributes({
      organizationId: tenant1.id,
      offset: 1,
      limit: 1,
    });

    expect(results).lengthOf(1);
  });
});
