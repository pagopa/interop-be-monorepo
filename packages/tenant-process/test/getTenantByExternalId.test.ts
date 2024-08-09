import { describe, expect, it } from "vitest";
import { generateId, Tenant } from "pagopa-interop-models";
import { addOneTenant, getMockTenant, readModelService } from "./utils.js";

describe("getTenantByExternalId", () => {
  const tenant1: Tenant = {
    ...getMockTenant(),
    id: generateId(),
    name: "A tenant1",
  };
  const tenant2: Tenant = {
    ...getMockTenant(),
    id: generateId(),
    name: "A tenant2",
  };

  it("should get the tenant by externalId", async () => {
    await addOneTenant(tenant1);
    await addOneTenant(tenant2);
    const tenantByExternalId = await readModelService.getTenantByExternalId({
      value: tenant1.externalId.value,
      origin: tenant1.externalId.origin,
    });
    expect(tenantByExternalId?.data).toEqual(tenant1);
  });
  it("should not get the tenant by externalId if it isn't in DB", async () => {
    const tenantByExternalId = await readModelService.getTenantByExternalId({
      value: tenant1.externalId.value,
      origin: tenant1.externalId.origin,
    });
    expect(tenantByExternalId?.data.externalId).toBeUndefined();
  });
});
