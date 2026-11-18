import { alias } from "drizzle-orm/pg-core";
import { ParentTenant } from "pagopa-interop-models";
import { toParentTenants } from "pagopa-interop-readmodel";
import { tenantInReadmodelTenant } from "pagopa-interop-readmodel-models";

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
): Map<string, ParentTenant[] | undefined> {
  return new Map(
    rows.map((row) => {
      const parent = toParentTenant(row.parent);
      const root =
        row.root && row.root.id !== row.parent?.id
          ? ParentTenant.parse({ id: row.root.id, name: row.root.name })
          : undefined;
      return [
        row.tenantId,
        toParentTenants({
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
