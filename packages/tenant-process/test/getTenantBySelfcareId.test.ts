/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import { generateId, Tenant } from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { getMockTenant } from "pagopa-interop-commons-test";
import { tenantNotFoundBySelfcareId } from "../src/model/domain/errors.js";
import { addOneTenant, tenantService } from "./utils.js";

describe("getTenantBySelfcareId", () => {
  const tenant1: Tenant = {
    ...getMockTenant(),
    id: generateId(),
    name: "Tenant 1",
  };
  const tenant2: Tenant = {
    ...getMockTenant(),
    id: generateId(),
    name: "Tenant 2",
  };
  const tenant3: Tenant = {
    ...getMockTenant(),
    id: generateId(),
    name: "Tenant 3",
  };

  it("should get the tenant by selfcareId", async () => {
    await addOneTenant(tenant1);
    await addOneTenant(tenant2);
    await addOneTenant(tenant3);
    const returnedTenant = await tenantService.getTenantBySelfcareId(
      tenant1.selfcareId!,
      genericLogger
    );
    expect(returnedTenant).toEqual(tenant1);
  });
  it("should throw tenantNotFoundBySelfcareId if the tenant isn't in DB", async () => {
    await addOneTenant(tenant2);
    expect(
      tenantService.getTenantBySelfcareId(tenant1.selfcareId!, genericLogger)
    ).rejects.toThrowError(tenantNotFoundBySelfcareId(tenant1.selfcareId!));
  });
});
