import { tenantUnitType } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { getMockBffApiCompactTenant } from "./mockUtils.js";

describe("getMockBffApiCompactTenant", () => {
  it("omits hierarchy by default", () => {
    const tenant = getMockBffApiCompactTenant();
    expect("subUnitType" in tenant).toBe(false);
    expect("parentTenants" in tenant).toBe(false);
  });

  it("generates a full hierarchy when requested", () => {
    const tenant = getMockBffApiCompactTenant({ populateHierarchy: true });
    expect(tenant.subUnitType).toBe(tenantUnitType.UO);
    expect(tenant.parentTenants).toEqual([
      {
        id: expect.any(String),
        name: "Tenant AOO",
        subUnitType: tenantUnitType.AOO,
      },
      { id: expect.any(String), name: "Tenant root" },
    ]);
  });
});
