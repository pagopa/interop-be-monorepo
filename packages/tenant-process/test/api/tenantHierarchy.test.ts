import { tenantApi } from "pagopa-interop-api-clients";
import {
  getMockTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  generateId,
  Tenant,
  TenantId,
  TenantV2,
  tenantUnitType,
  fromTenantV2,
  toTenantV2,
  ParentTenant,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import { toApiTenant } from "../../src/model/domain/apiConverter.js";
import { TenantWithHierarchy } from "../../src/model/domain/models.js";
import { readModelServiceBuilderSQL } from "../../src/services/readModelServiceSQL.js";
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
      parentTenant: { id: root.id, name: root.name },
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
    const tenant: TenantWithHierarchy = {
      ...Tenant.parse(getMockTenant()),
      parentTenant: ParentTenant.parse(parentTenant),
    };
    expect(tenant.parentTenant).toEqual(parentTenant);
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
    expect(Tenant.shape).not.toHaveProperty("parentTenant");
  });
});

describe("explicit tenant hierarchy read", () => {
  const root = getMockTenant();
  const parent = { ...getMockTenant(), subUnitType: tenantUnitType.AOO };
  const rootSummary = { id: root.id, name: root.name };
  const parentSummary = {
    id: parent.id,
    name: parent.name,
    subUnitType: parent.subUnitType,
  };
  const cases: Array<{
    name: string;
    tenant: Tenant;
    expected: TenantWithHierarchy["parentTenant"];
  }> = [
    { name: "root", tenant: root, expected: undefined },
    {
      name: "AOO with identical parent and root",
      tenant: {
        ...getMockTenant(),
        subUnitType: "AOO",
        parentTenantId: root.id,
        rootTenantId: root.id,
      },
      expected: rootSummary,
    },
    {
      name: "UO directly under root",
      tenant: {
        ...getMockTenant(),
        subUnitType: "UO",
        parentTenantId: root.id,
        rootTenantId: root.id,
      },
      expected: rootSummary,
    },
    {
      name: "UO under AOO under root",
      tenant: {
        ...getMockTenant(),
        subUnitType: "UO",
        parentTenantId: parent.id,
        rootTenantId: root.id,
      },
      expected: { ...parentSummary, parentTenant: rootSummary },
    },
    {
      name: "missing parent does not promote the root",
      tenant: {
        ...getMockTenant(),
        subUnitType: "UO",
        parentTenantId: generateId<TenantId>(),
        rootTenantId: root.id,
      },
      expected: undefined,
    },
    {
      name: "missing root preserves immediate parent",
      tenant: {
        ...getMockTenant(),
        subUnitType: "UO",
        parentTenantId: parent.id,
        rootTenantId: generateId<TenantId>(),
      },
      expected: parentSummary,
    },
    {
      name: "subUnitType is independent of hierarchy availability",
      tenant: { ...getMockTenant(), subUnitType: "UO" },
      expected: undefined,
    },
    {
      name: "hierarchy does not require subUnitType",
      tenant: {
        ...getMockTenant(),
        subUnitType: undefined,
        parentTenantId: root.id,
      },
      expected: rootSummary,
    },
  ];

  const setup = (tenant: Tenant | undefined) => {
    const getTenantById = vi
      .fn()
      .mockResolvedValue(tenant ? getMockWithMetadata(tenant) : undefined);
    const where = vi.fn().mockResolvedValue([rootSummary, parentSummary]);
    const select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where }),
    });
    type Args = Parameters<typeof readModelServiceBuilderSQL>;
    const service = readModelServiceBuilderSQL(
      { select } as unknown as Args[0],
      { getTenantById } as unknown as Args[1],
      {} as Args[2],
      {} as Args[3],
      {} as Args[4],
      {} as Args[5]
    );
    return { service, select, where, getTenantById };
  };

  it.each(cases)("$name", async ({ tenant, expected }) => {
    const { service, select } = setup(tenant);
    const result = await service.getTenantByIdWithHierarchy(tenant.id);
    expect(result?.data.parentTenant).toEqual(expected);
    expect(result?.data.subUnitType).toBe(tenant.subUnitType);
    expect(result?.data.name).toBe(tenant.name);
    expect(select).toHaveBeenCalledTimes(
      tenant.parentTenantId || tenant.rootTenantId ? 1 : 0
    );
  });

  it("keeps low-level reads unchanged and never queries ancestors", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      parentTenantId: root.id,
      rootTenantId: root.id,
    };
    const { service, select, getTenantById } = setup(tenant);
    expect(await service.getTenantById(tenant.id)).toBe(
      await getTenantById.mock.results[0].value
    );
    expect(select).not.toHaveBeenCalled();
  });

  it("returns undefined for an absent tenant without querying ancestors", async () => {
    const { service, select } = setup(undefined);
    expect(
      await service.getTenantByIdWithHierarchy(generateId())
    ).toBeUndefined();
    expect(select).not.toHaveBeenCalled();
  });

  it("keeps external-ID reads unhydrated", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      parentTenantId: root.id,
      rootTenantId: root.id,
    };
    const { service, select } = setup(tenant);
    const result = await service.getTenantByExternalId(tenant.externalId);
    expect(result?.data).toEqual(tenant);
    expect(result?.data).not.toHaveProperty("parentTenant");
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("rejects corrupt ancestor types instead of silently omitting the hierarchy", async () => {
    const tenant: Tenant = { ...getMockTenant(), parentTenantId: root.id };
    const { service, where } = setup(tenant);
    where.mockResolvedValue([{ ...rootSummary, subUnitType: "invalid" }]);
    await expect(
      service.getTenantByIdWithHierarchy(tenant.id)
    ).rejects.toThrow();
  });

  it.each([true, false])(
    "round-trips optional references in V2: %s",
    (withReferences) => {
      const tenant: Tenant = {
        ...getMockTenant(),
        parentTenantId: withReferences ? parent.id : undefined,
        rootTenantId: withReferences ? root.id : undefined,
      };
      const decoded = fromTenantV2(
        TenantV2.fromBinary(TenantV2.toBinary(toTenantV2(tenant)))
      );
      expect(decoded.parentTenantId).toBe(tenant.parentTenantId);
      expect(decoded.rootTenantId).toBe(tenant.rootTenantId);
      expect(decoded).not.toHaveProperty("parentTenant");
    }
  );

  it("propagates ancestor query failures instead of hiding corrupt data", async () => {
    const { service, where } = setup({
      ...getMockTenant(),
      parentTenantId: root.id,
    });
    const error = new Error("ancestor query failed");
    where.mockRejectedValue(error);
    await expect(service.getTenantByIdWithHierarchy(root.id)).rejects.toThrow(
      error
    );
  });
});
