import { inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ParentTenant, Tenant, TenantId } from "pagopa-interop-models";
import { aggregateTenantHierarchy } from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

import { TenantWithHierarchy } from "../model/domain/models.js";

export const parentTenantTable = alias(
  tenantInReadmodelTenant,
  "parentTenantTable"
);
export const rootTenantTable = alias(
  tenantInReadmodelTenant,
  "rootTenantTable"
);

export const tenantHierarchySelection = {
  parent: {
    id: parentTenantTable.id,
    name: parentTenantTable.name,
    subUnitType: parentTenantTable.subUnitType,
  },
  root: {
    id: rootTenantTable.id,
    name: rootTenantTable.name,
  },
};

type AncestorRow = {
  id: string;
  name: string;
  subUnitType: string | null;
};

function toParentTenant(
  row: AncestorRow | null | undefined
): ParentTenant | undefined {
  return row
    ? ParentTenant.parse({
        ...row,
        subUnitType: row.subUnitType ?? undefined,
      })
    : undefined;
}

export function getHierarchyByTenantId(
  rows: Array<{
    tenantId: string;
    parent: AncestorRow | null;
    root: Pick<AncestorRow, "id" | "name"> | null;
  }>
): Map<string, ParentTenant | undefined> {
  return new Map(
    rows.map((row) => {
      const parent = toParentTenant(row.parent);
      const root =
        row.root && row.root.id !== row.parent?.id
          ? ParentTenant.parse({ id: row.root.id, name: row.root.name })
          : undefined;
      return [
        row.tenantId,
        aggregateTenantHierarchy({
          parentTenantId: parent?.id ?? null,
          parentTenantName: parent?.name ?? null,
          parentTenantSubUnitType: parent?.subUnitType ?? null,
          rootTenantId: root?.id ?? null,
          rootTenantName: root?.name ?? null,
        }),
      ];
    })
  );
}

export async function addTenantHierarchy(
  readModelDB: DrizzleReturnType,
  tenants: Tenant[]
): Promise<TenantWithHierarchy[]> {
  const ancestorIds = [
    ...new Set(
      tenants.flatMap((tenant) =>
        [tenant.parentTenantId, tenant.rootTenantId].filter(
          (id): id is TenantId => id !== undefined
        )
      )
    ),
  ];
  if (ancestorIds.length === 0) {
    return tenants;
  }

  const ancestorRows = await readModelDB
    .select({
      id: tenantInReadmodelTenant.id,
      name: tenantInReadmodelTenant.name,
      subUnitType: tenantInReadmodelTenant.subUnitType,
    })
    .from(tenantInReadmodelTenant)
    .where(inArray(tenantInReadmodelTenant.id, ancestorIds));
  const ancestorsById = new Map(ancestorRows.map((row) => [row.id, row]));
  const hierarchyById = getHierarchyByTenantId(
    tenants.map((tenant) => ({
      tenantId: tenant.id,
      parent: tenant.parentTenantId
        ? (ancestorsById.get(tenant.parentTenantId) ?? null)
        : null,
      root: tenant.rootTenantId
        ? (ancestorsById.get(tenant.rootTenantId) ?? null)
        : null,
    }))
  );

  return tenants.map((tenant) => ({
    ...tenant,
    parentTenant: hierarchyById.get(tenant.id),
  }));
}
