import { generateId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { aggregateTenantHierarchy } from "../../src/tenant/aggregators.js";

describe("aggregateTenantHierarchy", () => {
  const parentId = generateId();
  const rootId = generateId();
  const row = {
    parentTenantId: parentId,
    parentTenantName: "Area",
    parentTenantSubUnitType: "AOO",
    rootTenantId: rootId,
    rootTenantName: "Institution",
  };

  it("builds parent and root with their original names", () => {
    expect(aggregateTenantHierarchy(row)).toEqual({
      id: parentId,
      name: "Area",
      subUnitType: "AOO",
      parentTenant: { id: rootId, name: "Institution" },
    });
  });

  it("does not duplicate an identical parent and root", () => {
    expect(
      aggregateTenantHierarchy({ ...row, rootTenantId: parentId })
    ).toEqual({ id: parentId, name: "Area", subUnitType: "AOO" });
  });

  it.each(["parentTenantId", "parentTenantName"] as const)(
    "does not promote the root when %s is missing",
    (field) => {
      expect(
        aggregateTenantHierarchy({ ...row, [field]: null })
      ).toBeUndefined();
    }
  );

  it.each(["rootTenantId", "rootTenantName"] as const)(
    "preserves the parent when %s is missing",
    (field) => {
      expect(aggregateTenantHierarchy({ ...row, [field]: null })).toEqual({
        id: parentId,
        name: "Area",
        subUnitType: "AOO",
      });
    }
  );

  it("does not interpret an empty name as a missing ancestor", () => {
    expect(
      aggregateTenantHierarchy({ ...row, parentTenantName: "" })?.name
    ).toBe("");
  });

  it("rejects an invalid parentTenantSubUnitType", () => {
    expect(() =>
      aggregateTenantHierarchy({ ...row, parentTenantSubUnitType: "invalid" })
    ).toThrow();
  });
});
