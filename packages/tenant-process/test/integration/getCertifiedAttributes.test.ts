import {
  getMockAttribute,
  getMockTenant,
  getMockCertifiedTenantAttribute,
  getMockCertifiedDiscreteTenantAttribute,
  getMockContext,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  Attribute,
  attributeKind,
  Tenant,
  TenantAttribute,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";

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
  it("should get standard and discrete certified attributes", async () => {
    const certifierId: string = "test";
    const tenantCertifier: Tenant = {
      ...getMockTenant(),
      features: [{ type: "PersistentCertifier" as const, certifierId }],
    };
    const tenant: Tenant = getMockTenant();

    const tenantCertifiedAttribute: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const tenantCertifiedDiscreteAttribute: TenantAttribute = {
      ...getMockCertifiedDiscreteTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const certifiedAttribute: Attribute = {
      ...getMockAttribute(attributeKind.certified),
      origin: certifierId,
      id: tenantCertifiedAttribute.id,
    };
    const certifiedDiscreteAttribute: Attribute = {
      ...getMockAttribute(attributeKind.certifiedDiscrete),
      origin: certifierId,
      id: tenantCertifiedDiscreteAttribute.id,
    };

    await addOneAttribute(certifiedAttribute);
    await addOneAttribute(certifiedDiscreteAttribute);
    await addOneTenant(tenantCertifier);
    await addOneTenant({
      ...tenant,
      attributes: [tenantCertifiedAttribute, tenantCertifiedDiscreteAttribute],
    });

    const result = await tenantService.getCertifiedAttributes(
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(tenantCertifier.id) })
    );

    expect(result).toEqual({
      results: expect.arrayContaining([
        {
          attributeId: certifiedAttribute.id,
          attributeName: certifiedAttribute.name,
          id: tenant.id,
          kind: "CERTIFIED",
          name: tenant.name,
        },
        {
          attributeId: certifiedDiscreteAttribute.id,
          attributeName: certifiedDiscreteAttribute.name,
          id: tenant.id,
          kind: "CERTIFIED_DISCRETE",
          name: tenant.name,
        },
      ]),
      totalCount: 2,
    });
  });

  it("should paginate standard and discrete certified attributes together", async () => {
    const certifierId: string = "test";
    const tenantCertifier: Tenant = {
      ...getMockTenant(),
      features: [{ type: "PersistentCertifier" as const, certifierId }],
    };
    const tenant: Tenant = getMockTenant();

    const tenantCertifiedAttribute: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const tenantCertifiedDiscreteAttribute: TenantAttribute = {
      ...getMockCertifiedDiscreteTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const certifiedAttribute: Attribute = {
      ...getMockAttribute(attributeKind.certified),
      id: tenantCertifiedAttribute.id,
      name: "A standard certified attribute",
      origin: certifierId,
    };
    const certifiedDiscreteAttribute: Attribute = {
      ...getMockAttribute(attributeKind.certifiedDiscrete),
      id: tenantCertifiedDiscreteAttribute.id,
      name: "B discrete certified attribute",
      origin: certifierId,
    };

    await addOneAttribute(certifiedAttribute);
    await addOneAttribute(certifiedDiscreteAttribute);
    await addOneTenant(tenantCertifier);
    await addOneTenant({
      ...tenant,
      attributes: [tenantCertifiedAttribute, tenantCertifiedDiscreteAttribute],
    });

    const firstPage = await tenantService.getCertifiedAttributes(
      { offset: 0, limit: 1 },
      getMockContext({ authData: getMockAuthData(tenantCertifier.id) })
    );
    const secondPage = await tenantService.getCertifiedAttributes(
      { offset: 1, limit: 1 },
      getMockContext({ authData: getMockAuthData(tenantCertifier.id) })
    );

    expect(firstPage).toEqual({
      results: [
        {
          attributeId: certifiedAttribute.id,
          attributeName: certifiedAttribute.name,
          id: tenant.id,
          kind: "CERTIFIED",
          name: tenant.name,
        },
      ],
      totalCount: 2,
    });
    expect(secondPage).toEqual({
      results: [
        {
          attributeId: certifiedDiscreteAttribute.id,
          attributeName: certifiedDiscreteAttribute.name,
          id: tenant.id,
          kind: "CERTIFIED_DISCRETE",
          name: tenant.name,
        },
      ],
      totalCount: 2,
    });
  });

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
          kind: "CERTIFIED",
          name: tenant.name,
        },
        {
          attributeId: certifiedAttribute2.id,
          attributeName: certifiedAttribute2.name,
          id: tenant.id,
          kind: "CERTIFIED",
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
