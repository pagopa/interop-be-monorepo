import { bffApi } from "pagopa-interop-api-clients";
import { tenantUnitType } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  getMockBffApiCompactOrganization,
  getMockBffApiCompactTenant,
} from "./mockUtils.js";

describe("getMockBffApiCompactTenant", () => {
  it.each([undefined, false])("omits hierarchy for %s", (populateHierarchy) => {
    const tenant = getMockBffApiCompactTenant({ populateHierarchy });
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

describe("getMockBffApiCompactOrganization", () => {
  it.each([undefined, false])("omits hierarchy for %s", (populateHierarchy) => {
    const organization = getMockBffApiCompactOrganization({
      populateHierarchy,
    });
    expect(bffApi.CompactOrganization.parse(organization)).toEqual(
      organization
    );
    expect("subUnitType" in organization).toBe(false);
    expect("parentTenants" in organization).toBe(false);
  });

  it("generates a full hierarchy when requested", () => {
    const organization = getMockBffApiCompactOrganization({
      populateHierarchy: true,
    });
    expect(bffApi.CompactOrganization.parse(organization)).toEqual(
      organization
    );
    expect(organization.subUnitType).toBe(tenantUnitType.UO);
    expect(organization.parentTenants).toEqual([
      {
        id: expect.any(String),
        name: "Tenant AOO",
        subUnitType: tenantUnitType.AOO,
      },
      { id: expect.any(String), name: "Tenant root" },
    ]);
  });
});
