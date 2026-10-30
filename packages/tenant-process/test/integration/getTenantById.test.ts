/* eslint-disable @typescript-eslint/no-floating-promises */
import { getMockContext, getMockTenant } from "pagopa-interop-commons-test";
import { Tenant, tenantUnitType } from "pagopa-interop-models";
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
  it("should throw tenantNotFound if the tenant isn't in DB", async () => {
    await addOneTenant(tenant2);
    await expect(
      tenantService.getTenantById(tenant1.id, getMockContext({}))
    ).rejects.toThrowError(tenantNotFound(tenant1.id));
  });

  it("should resolve a unit hierarchy with its root without duplicating the root", async () => {
    const root: Tenant = { ...getMockTenant(), name: "Root institution" };
    const aoo: Tenant = {
      ...getMockTenant(),
      name: "AOO",
      subUnitType: tenantUnitType.AOO,
      parentTenantId: root.id,
      rootTenantId: root.id,
    };
    const unit: Tenant = {
      ...getMockTenant(),
      name: "UO",
      subUnitType: tenantUnitType.UO,
      parentTenantId: aoo.id,
      rootTenantId: root.id,
    };

    await addOneTenant(root);
    await addOneTenant(aoo);
    await addOneTenant(unit);

    const result = await tenantService.getTenantById(
      unit.id,
      getMockContext({})
    );

    expect(result.data.parentTenant).toEqual({
      id: aoo.id,
      name: aoo.name,
      subUnitType: tenantUnitType.AOO,
      parentTenant: {
        id: root.id,
        name: root.name,
      },
    });

    const rootResult = await tenantService.getTenantById(
      root.id,
      getMockContext({})
    );
    expect(rootResult.data.parentTenant).toBeUndefined();
  });
});
