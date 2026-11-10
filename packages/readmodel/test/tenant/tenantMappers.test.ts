import { generateId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { toParentTenants } from "../../src/tenant/mappers.js";

describe("Tenant mappers", () => {
  const parentId = generateId();
  const rootId = generateId();
  const row = {
    parentTenantId: parentId,
    parentTenantName: "Tenant AOO",
    parentTenantSubUnitType: "AOO",
    rootTenantId: rootId,
    rootTenantName: "Tenant root",
  };

  it("should map the parent and root with their original names", () => {
    expect(toParentTenants(row)).toEqual([
      { id: parentId, name: "Tenant AOO", subUnitType: "AOO" },
      { id: rootId, name: "Tenant root" },
    ]);
  });

  it("should not duplicate an identical parent and root", () => {
    expect(toParentTenants({ ...row, rootTenantId: parentId })).toEqual([
      { id: parentId, name: "Tenant AOO", subUnitType: "AOO" },
    ]);
  });

  it.each(["parentTenantId", "parentTenantName"] as const)(
    "should not promote the root when %s is missing",
    (field) => {
      expect(toParentTenants({ ...row, [field]: null })).toBeUndefined();
    }
  );

  it.each(["rootTenantId", "rootTenantName"] as const)(
    "should preserve the parent when %s is missing",
    (field) => {
      expect(toParentTenants({ ...row, [field]: null })).toEqual([
        { id: parentId, name: "Tenant AOO", subUnitType: "AOO" },
      ]);
    }
  );

  it("should preserve an empty ancestor name", () => {
    expect(toParentTenants({ ...row, parentTenantName: "" })?.[0].name).toBe(
      ""
    );
  });

  it("should reject an invalid parent tenant sub-unit type", () => {
    expect(() =>
      toParentTenants({
        ...row,
        parentTenantSubUnitType: "invalid",
      })
    ).toThrow();
  });
});
