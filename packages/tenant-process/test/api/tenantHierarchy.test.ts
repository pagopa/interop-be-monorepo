import { tenantApi } from "pagopa-interop-api-clients";
import { getMockTenant } from "pagopa-interop-commons-test";
import {
  generateId,
  ParentTenant,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { toApiTenant } from "../../src/model/domain/apiConverter.js";
import { TenantHierarchy } from "../../src/model/domain/models.js";
import { getHierarchyByTenantId } from "../../src/services/tenantHierarchySQL.js";

describe("joined tenant hierarchy mapping", () => {
  const parent = {
    id: generateId<TenantId>(),
    name: "Area",
    subUnitType: "AOO",
  };
  const root = { id: generateId<TenantId>(), name: "Root" };

  it("uses the shared mapping without dropping empty ancestor names", () => {
    const tenantId = generateId<TenantId>();
    const hierarchy = getHierarchyByTenantId([
      { tenantId, parent: { ...parent, name: "" }, root },
    ]);
    expect(hierarchy.get(tenantId)).toEqual({
      ...parent,
      name: "",
      parentTenant: root,
    });
  });

  it("validates an available root even when the parent is missing", () => {
    expect(() =>
      getHierarchyByTenantId([
        {
          tenantId: generateId<TenantId>(),
          parent: null,
          root: { ...root, id: "invalid" },
        },
      ])
    ).toThrow();
  });
});

describe("recursive tenant hierarchy conversion", () => {
  it("preserves ancestors beyond the current hierarchy depth", () => {
    const parentTenant = {
      id: generateId<TenantId>(),
      name: "Parent",
      parentTenant: {
        id: generateId<TenantId>(),
        name: "Ancestor",
        parentTenant: { id: generateId<TenantId>(), name: "Root" },
      },
    };
    const tenant: Tenant & TenantHierarchy = {
      ...getMockTenant(),
      parentTenant: ParentTenant.parse(parentTenant),
    };
    expect(tenantApi.Tenant.parse(toApiTenant(tenant)).parentTenant).toEqual(
      parentTenant
    );
  });

  it("keeps derived hierarchy out of the domain schema", () => {
    const input = {
      ...getMockTenant(),
      parentTenantId: generateId<TenantId>(),
      rootTenantId: generateId<TenantId>(),
      parentTenant: { id: generateId<TenantId>(), name: "Parent" },
    };
    const tenant = Tenant.parse(input);
    expect(tenant).not.toHaveProperty("parentTenant");
    expect(tenant.parentTenantId).toBe(input.parentTenantId);
    expect(tenant.rootTenantId).toBe(input.rootTenantId);
  });
});
