import { sql, asc, SQL, Column, Table, count } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { PgSelect } from "drizzle-orm/pg-core";
import { ListResult } from "pagopa-interop-models";

export const createListResult = <T>(
  items: T[],
  totalCount?: number,
): ListResult<T> => ({
  results: items,
  totalCount: totalCount ?? 0,
});

export const lowerCase = (column: Column): SQL => sql<string>`LOWER(${column})`;

// see: https://orm.drizzle.team/docs/guides/limit-offset-pagination
export const ascLower = (column: Column): SQL => asc(lowerCase(column));

export const withTotalCount = <
  P extends Record<string, Table | Column | SQL | SQL.Aliased>,
>(
  projection: P,
): P & { totalCount: SQL.Aliased<number> } => ({
  ...projection,
  totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
});

export async function getTableTotalCount(
  db: NodePgDatabase,
  query: PgSelect,
): Promise<number> {
  const totalCountResult = await db
    .select({ count: count() })
    .from(query.as("filterQuery"))
    .limit(1);
  return totalCountResult[0]?.count ?? 0;
}
