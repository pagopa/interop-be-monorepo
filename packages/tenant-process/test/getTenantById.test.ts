import { describe, expect, it } from "vitest";
import { generateId, Tenant } from "pagopa-interop-models";
import { addOneTenant, getMockTenant, readModelService } from "./utils.js";

describe("getTenantById", () => {
  const mockTenant = getMockTenant();

  const tenant1: Tenant = {
    ...mockTenant,
    id: generateId(),
    name: "A tenant1",
  };
  const tenant2: Tenant = {
    ...mockTenant,
    id: generateId(),
    name: "A tenant2",
  };
  const tenant3: Tenant = {
    ...mockTenant,
    id: generateId(),
    name: "A tenant3",
  };

  it("should get the tenant by ID", async () => {
    await addOneTenant(tenant1);
    await addOneTenant(tenant2);
    await addOneTenant(tenant3);
    const tenantById = await readModelService.getTenantById(tenant1.id);
    expect(tenantById?.data).toEqual(tenant1);
  });
  it("should not get the tenant by ID if it isn't in DB", async () => {
    const tenantById = await readModelService.getTenantById(tenant1.id);
    expect(tenantById?.data.id).toBeUndefined();
  });
});
