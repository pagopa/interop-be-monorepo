import { getTableColumns, sql, asc, SQL, Table, Column } from "drizzle-orm";
import { ListResult } from "pagopa-interop-models";

export const createListResult = <T>(
  items: T[],
  totalCount?: number
): ListResult<T> => ({
  results: items,
  totalCount: totalCount ?? 0,
});

// see: https://orm.drizzle.team/docs/guides/limit-offset-pagination
export const ascLower = <T = string>(column: Column | SQL | SQL.Aliased): SQL =>
  asc(sql<T>`LOWER(${column})`);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const withTotalCount = <T extends Table>(tbl: T) => ({
  ...getTableColumns(tbl),
  totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
});
