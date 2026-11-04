import { SQL, sql } from "drizzle-orm";
import { PgColumn } from "drizzle-orm/pg-core";
import { escapeSqlLike, ilikeEscaped } from "pagopa-interop-commons";

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
          AND ${rootTenantId} <> ${parentTenantId}
        THEN ${rootTenantName}
      END
    )`,
    `%${escapeSqlLike(name)}%`
  );
}
