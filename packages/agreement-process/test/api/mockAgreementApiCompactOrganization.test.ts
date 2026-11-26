import { agreementApi } from "pagopa-interop-api-clients";
import { getMockTenantHierarchy } from "pagopa-interop-commons-test";
import { tenantUnitType } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { getMockAgreementApiCompactOrganization } from "../mockUtils.js";

describe("getMockAgreementApiCompactOrganization", () => {
  const root = { id: expect.any(String), name: "Tenant root" };
  const aoo = {
    id: expect.any(String),
    name: "Tenant AOO",
    subUnitType: tenantUnitType.AOO,
  };

  it.each([undefined, false])(
    "omits the hierarchy for %s",
    (populateHierarchy) => {
      expect(getMockTenantHierarchy({ populateHierarchy })).toEqual({});
      const organization = getMockAgreementApiCompactOrganization({
        populateHierarchy,
      });
      expect(agreementApi.CompactOrganization.parse(organization)).toEqual(
        organization
      );
      expect("subUnitType" in organization).toBe(false);
      expect("parentTenants" in organization).toBe(false);
    }
  );

  it("generates a full UO hierarchy when requested", () => {
    const hierarchy = getMockTenantHierarchy({ populateHierarchy: true });
    expect(hierarchy).toEqual({
      subUnitType: tenantUnitType.UO,
      parentTenants: [aoo, root],
    });
    const organization = getMockAgreementApiCompactOrganization({
      populateHierarchy: true,
    });
    expect(agreementApi.CompactOrganization.parse(organization)).toEqual(
      organization
    );
    expect(organization.subUnitType).toBe(tenantUnitType.UO);
    expect(organization.parentTenants).toEqual([aoo, root]);
  });
});
