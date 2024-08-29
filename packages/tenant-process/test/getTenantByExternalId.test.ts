/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import { Tenant } from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { tenantBySelfcareIdNotFound } from "../src/model/domain/errors.js";
import { addOneTenant, getMockTenant, tenantService } from "./utils.js";

describe("getTenantByExternalId", () => {
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

  it("should get the tenant by externalId", async () => {
    await addOneTenant(tenant1);
    await addOneTenant(tenant2);
    await addOneTenant(tenant3);
    const returnedTenant = await tenantService.getTenantByExternalId(
      {
        value: tenant1.externalId.value,
        origin: tenant1.externalId.origin,
      },
      genericLogger
    );
    expect(returnedTenant).toEqual(tenant1);
  });
  it("should throw tenantNotFoundByExternalId if it isn't in DB", async () => {
    await addOneTenant(tenant2);
    expect(
      tenantService.getTenantByExternalId(
        {
          value: tenant1.externalId.value,
          origin: tenant1.externalId.origin,
        },
        genericLogger
      )
    ).rejects.toThrowError(
      tenantBySelfcareIdNotFound(
        `${tenant1.externalId.origin} - ${tenant1.externalId.value}`
      )
    );
  });
});
