import { sql, asc, SQL, Column, Table } from "drizzle-orm";
import { ListResult } from "pagopa-interop-models";

export const createListResult = <T>(
  items: T[],
  totalCount?: number
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
  projection: P
): P & { totalCount: SQL.Aliased<number> } => ({
  ...projection,
  totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
});
