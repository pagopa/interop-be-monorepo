/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import { Tenant } from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { getMockTenant } from "pagopa-interop-commons-test";
import { tenantNotFound } from "../src/model/domain/errors.js";
import { addOneTenant, tenantService } from "./utils.js";

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
    const returnedTenant = await tenantService.getTenantById(
      tenant1.id,
      genericLogger
    );
    expect(returnedTenant).toEqual(tenant1);
  });
  it("should throw tenantNotFound if the tenant isn't in DB", async () => {
    await addOneTenant(tenant2);
    expect(
      tenantService.getTenantById(tenant1.id, genericLogger)
    ).rejects.toThrowError(tenantNotFound(tenant1.id));
  });
});
