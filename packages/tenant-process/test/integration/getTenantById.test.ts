/* eslint-disable @typescript-eslint/no-floating-promises */
import { getMockContext, getMockTenant } from "pagopa-interop-commons-test";
import { ParentTenant, Tenant } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { tenantNotFound } from "../../src/model/domain/errors.js";
import { addOneTenant, tenantService } from "../integrationUtils.js";

describe("getTenantById", () => {
  const tenant1: Tenant = {
    ...getMockTenant(),
    name: "Tenant 1",
  };
  const tenant2: Tenant = {
    ...getMockTenant(),
    name: "Tenant 2",
  };
  const tenant3: Tenant = {
    ...getMockTenant(),
    name: "Tenant 3",
  };

  it("should get the tenant by ID", async () => {
    await addOneTenant(tenant1);
    await addOneTenant(tenant2);
    await addOneTenant(tenant3);
    const getTenantByIdResponse = await tenantService.getTenantById(
      tenant1.id,
      getMockContext({})
    );
    expect(getTenantByIdResponse).toEqual({
      data: tenant1,
      metadata: {
        version: 0,
      },
    });
  });

  it("should return the parent and root tenants when available", async () => {
    const rootTenant: Tenant = {
      ...getMockTenant(),
      name: "Tenant root",
    };
    const parentTenant: Tenant = {
      ...getMockTenant(),
      name: "Tenant AOO",
      subUnitType: "AOO",
      parentTenantId: rootTenant.id,
      rootTenantId: rootTenant.id,
    };
    const tenant: Tenant = {
      ...getMockTenant(),
      name: "Tenant UO",
      subUnitType: "UO",
      parentTenantId: parentTenant.id,
      rootTenantId: rootTenant.id,
    };

    await addOneTenant(rootTenant);
    await addOneTenant(parentTenant);
    await addOneTenant(tenant);

    const result = await tenantService.getTenantById(
      tenant.id,
      getMockContext({})
    );

    const expectedParentTenants: ParentTenant[] = [
      {
        id: parentTenant.id,
        name: parentTenant.name,
        subUnitType: parentTenant.subUnitType,
      },
      {
        id: rootTenant.id,
        name: rootTenant.name,
      },
    ];

    expect(result.data.parentTenants).toEqual(expectedParentTenants);
  });

  it("should throw tenantNotFound if the tenant isn't in DB", async () => {
    await addOneTenant(tenant2);
    expect(
      tenantService.getTenantById(tenant1.id, getMockContext({}))
    ).rejects.toThrowError(tenantNotFound(tenant1.id));
  });
});
