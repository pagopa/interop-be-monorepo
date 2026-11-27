import { SQL, sql } from "drizzle-orm";
import { PgColumn } from "drizzle-orm/pg-core";
import { escapeSqlLike, ilikeEscaped } from "pagopa-interop-commons";

/**
 * Searches the tenant's composed name, including resolved ancestors.
 * The root is included only when the parent is resolved, and only once
 * when the parent and root are the same tenant.
 */
export function getTenantHierarchyNameFilter(
  name: string | undefined,
  tenantName: PgColumn,
  parentTenantId: PgColumn,
  parentTenantName: PgColumn,
  rootTenantId: PgColumn,
  rootTenantName: PgColumn
): SQL | undefined {
  if (name === undefined) {
    return undefined;
  }

  return ilikeEscaped(
    sql`concat_ws(' - ',
      ${tenantName},
      ${parentTenantName},
      CASE
        WHEN ${parentTenantId} IS NOT NULL
          AND ${parentTenantName} IS NOT NULL
          AND ${rootTenantId} <> ${parentTenantId}
        THEN ${rootTenantName}
      END
    )`,
    `%${escapeSqlLike(name)}%`
  );
}
