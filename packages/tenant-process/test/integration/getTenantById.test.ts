/* eslint-disable @typescript-eslint/no-floating-promises */
import { getMockContext, getMockTenant } from "pagopa-interop-commons-test";
import {
  generateId,
  Tenant,
  TenantId,
  tenantUnitType,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import { tenantNotFound } from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  readModelService,
  tenantService,
} from "../integrationUtils.js";

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

  describe("getTenantByIdWithHierarchy", () => {
    it("retrieves a tenant without ancestor references", async () => {
      const tenant: Tenant = {
        ...getMockTenant(),
        parentTenantId: undefined,
        rootTenantId: undefined,
      };
      await addOneTenant(tenant);
      expect(
        await readModelService.getTenantByIdWithHierarchy(tenant.id)
      ).toEqual({
        data: tenant,
        metadata: { version: 0 },
      });
    });

    it.each([
      { direct: true, missingParent: false, missingRoot: false },
      { direct: false, missingParent: false, missingRoot: false },
      { direct: false, missingParent: true, missingRoot: false },
      { direct: false, missingParent: false, missingRoot: true },
    ])(
      "retrieves hierarchy through ancestor joins: %j",
      async ({ direct, missingParent, missingRoot }) => {
        const root: Tenant = { ...getMockTenant(), name: "Institution" };
        const parent: Tenant = {
          ...getMockTenant(),
          name: "",
          subUnitType: tenantUnitType.AOO,
        };
        const tenant: Tenant = {
          ...getMockTenant(),
          parentTenantId: missingParent
            ? generateId<TenantId>()
            : direct
              ? root.id
              : parent.id,
          rootTenantId: missingRoot ? generateId<TenantId>() : root.id,
        };
        await addOneTenant(root);
        await addOneTenant(parent);
        await addOneTenant(tenant);

        const result = await readModelService.getTenantByIdWithHierarchy(
          tenant.id
        );
        const rootSummary = { id: root.id, name: root.name };
        expect(result?.data).toEqual({
          ...tenant,
          parentTenant: missingParent
            ? undefined
            : direct
              ? rootSummary
              : {
                  id: parent.id,
                  name: parent.name,
                  subUnitType: parent.subUnitType,
                  parentTenant: missingRoot ? undefined : rootSummary,
                },
        });
        expect(result?.metadata).toEqual({ version: 0 });
      }
    );
  });
  it("should throw tenantNotFound if the tenant isn't in DB", async () => {
    await addOneTenant(tenant2);
    await expect(
      tenantService.getTenantById(tenant1.id, getMockContext({}))
    ).rejects.toThrowError(tenantNotFound(tenant1.id));
  });

  it("should retrieve hierarchy for the tenant", async () => {
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

    const hierarchyRead = vi.spyOn(
      readModelService,
      "getTenantByIdWithHierarchy"
    );
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
    expect(result.metadata).toEqual({ version: 0 });
    expect(hierarchyRead).toHaveBeenCalledTimes(1);
    hierarchyRead.mockRestore();

    const rootResult = await tenantService.getTenantById(
      root.id,
      getMockContext({})
    );
    expect(rootResult.data.parentTenant).toBeUndefined();
  });
});
