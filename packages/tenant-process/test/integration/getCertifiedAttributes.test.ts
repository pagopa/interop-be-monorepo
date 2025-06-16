import { Attribute, Tenant, TenantAttribute } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockAttribute,
  getMockTenant,
  getMockCertifiedTenantAttribute,
  getMockContext,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  tenantIsNotACertifier,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneTenant,
  tenantService,
} from "../integrationUtils.js";

describe("getCertifiedAttributes", () => {
  it("should get certified attributes certified by the passed certifier id", async () => {
    const certifierId: string = "test";
    const tenantCertifier = {
      ...getMockTenant(),
      features: [{ type: "PersistentCertifier" as const, certifierId }],
    };
    const tenant = getMockTenant();

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
      origin: certifierId,
      id: tenantCertifiedAttribute1.id,
    };

    const certifiedAttribute2: Attribute = {
      ...getMockAttribute(),
      origin: certifierId,
      id: tenantCertifiedAttribute2.id,
    };

    await addOneAttribute(certifiedAttribute1);
    await addOneAttribute(certifiedAttribute2);

    const tenantWithCertifiedAttributes: Tenant = {
      ...tenant,
      attributes: [tenantCertifiedAttribute1, tenantCertifiedAttribute2],
    };

    await addOneTenant(tenantCertifier);
    await addOneTenant(tenantWithCertifiedAttributes);

    const result = await tenantService.getCertifiedAttributes(
      {
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(tenantCertifier.id) })
    );

    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual(
      expect.arrayContaining([
        {
          attributeId: certifiedAttribute1.id,
          attributeName: certifiedAttribute1.name,
          id: tenant.id,
          name: tenant.name,
        },
        {
          attributeId: certifiedAttribute2.id,
          attributeName: certifiedAttribute2.name,
          id: tenant.id,
          name: tenant.name,
        },
      ])
    );
  });

  it("should not return the attributes when they are revoked", async () => {
    const certifierId: string = "test";
    const tenantCertifier = {
      ...getMockTenant(),
      features: [{ type: "PersistentCertifier" as const, certifierId }],
    };
    const tenant = getMockTenant();

    const tenantCertifiedAttribute: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const revokedTenantCertifiedAttribute: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const certifiedAttribute: Attribute = {
      ...getMockAttribute(),
      origin: certifierId,
      id: tenantCertifiedAttribute.id,
    };

    const revokedCertifiedAttribute: Attribute = {
      ...getMockAttribute(),
      origin: certifierId,
      id: revokedTenantCertifiedAttribute.id,
    };

    await addOneAttribute(certifiedAttribute);
    await addOneAttribute(revokedCertifiedAttribute);

    const tenantWithCertifiedAttributes: Tenant = {
      ...tenant,
      attributes: [tenantCertifiedAttribute, revokedTenantCertifiedAttribute],
    };

    await addOneTenant(tenantCertifier);
    await addOneTenant(tenantWithCertifiedAttributes);

    const result = await tenantService.getCertifiedAttributes(
      {
        offset: 0,
        limit: 50,
      },
      getMockContext({ authData: getMockAuthData(tenantCertifier.id) })
    );

    expect(result.totalCount).toBe(1);
    expect(result.results).not.toContainEqual([
      {
        attributeId: certifiedAttribute.id,
        attributeName: revokedCertifiedAttribute.name,
        id: tenant.id,
        name: tenant.name,
      },
    ]);
  });

  it("should throw tenantNotFound error if the caller tenant is not present in the read model", async () => {
    const certifierId: string = "test";
    const tenantCertifier = {
      ...getMockTenant(),
      features: [{ type: "PersistentCertifier" as const, certifierId }],
    };
    const tenant = getMockTenant();

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
      origin: certifierId,
      id: tenantCertifiedAttribute1.id,
    };

    const certifiedAttribute2: Attribute = {
      ...getMockAttribute(),
      origin: certifierId,
      id: tenantCertifiedAttribute2.id,
    };

    await addOneAttribute(certifiedAttribute1);
    await addOneAttribute(certifiedAttribute2);

    const tenantWithCertifiedAttributes: Tenant = {
      ...tenant,
      attributes: [tenantCertifiedAttribute1, tenantCertifiedAttribute2],
    };

    await addOneTenant(tenantWithCertifiedAttributes);

    void expect(
      tenantService.getCertifiedAttributes(
        {
          offset: 0,
          limit: 50,
        },
        getMockContext({ authData: getMockAuthData(tenantCertifier.id) })
      )
    ).rejects.toThrowError(tenantNotFound(tenantCertifier.id));
  });

  it("should throw tenantIsNotACertifier error if the caller tenant is not a certifier", async () => {
    const certifierId: string = "test";
    const tenantNotCertifier = {
      ...getMockTenant(),
      features: [],
    };
    const tenant = getMockTenant();

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
      origin: certifierId,
      id: tenantCertifiedAttribute1.id,
    };

    const certifiedAttribute2: Attribute = {
      ...getMockAttribute(),
      origin: certifierId,
      id: tenantCertifiedAttribute2.id,
    };

    await addOneAttribute(certifiedAttribute1);
    await addOneAttribute(certifiedAttribute2);

    const tenantWithCertifiedAttributes: Tenant = {
      ...tenant,
      attributes: [tenantCertifiedAttribute1, tenantCertifiedAttribute2],
    };

    await addOneTenant(tenantNotCertifier);
    await addOneTenant(tenantWithCertifiedAttributes);

    void expect(
      tenantService.getCertifiedAttributes(
        {
          offset: 0,
          limit: 50,
        },
        getMockContext({ authData: getMockAuthData(tenantNotCertifier.id) })
      )
    ).rejects.toThrowError(tenantIsNotACertifier(tenantNotCertifier.id));
  });
});
