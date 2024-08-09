import { describe, expect, it } from "vitest";
import { generateId, Tenant } from "pagopa-interop-models";
import { addOneTenant, getMockTenant, readModelService } from "./utils.js";

describe("getTenantBySelfcareId", () => {
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

  it("should get the tenant by selfcareId", async () => {
    await addOneTenant(tenant1);
    await addOneTenant(tenant2);
    const tenantBySelfcareId = await readModelService.getTenantBySelfcareId(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      tenant1.selfcareId!
    );
    expect(tenantBySelfcareId?.data).toEqual(tenant1);
  });
  it("should not get the tenant by selfcareId if it isn't in DB", async () => {
    const tenantBySelfcareId = await readModelService.getTenantBySelfcareId(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      tenant1.selfcareId!
    );
    expect(tenantBySelfcareId?.data.selfcareId).toBeUndefined();
  });
});
