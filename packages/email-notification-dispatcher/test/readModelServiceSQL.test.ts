import { getMockTenant } from "pagopa-interop-commons-test";
import { Tenant } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { addOneTenant, readModelService } from "./utils.js";

describe("Notification tenant names", () => {
  it("should compose bulk lookup names while preserving tenant data", async () => {
    const root = { ...getMockTenant(), name: "Comune di Roma" };
    const tenant: Tenant = {
      ...getMockTenant(),
      name: "UO Servizi",
      subUnitType: "UO",
      parentTenantId: root.id,
      rootTenantId: root.id,
    };
    await addOneTenant(root);
    await addOneTenant(tenant);

    const tenants = await readModelService.getTenantsById([root.id, tenant.id]);

    expect(tenants).toHaveLength(2);
    expect(tenants).toEqual(
      expect.arrayContaining([
        root,
        { ...tenant, name: "UO Servizi - Comune di Roma" },
      ])
    );
  });
});
