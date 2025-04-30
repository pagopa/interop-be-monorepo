import { getTableColumns, sql, asc, SQL, Table, Column } from "drizzle-orm";
import { ListResult } from "pagopa-interop-models";

export const createListResult = <T>(
  items: Array<{ data: T } | T>,
  totalCount?: number
): ListResult<T> => ({
  results: items.map(
    (item): T =>
      item !== null && typeof item === "object" && "data" in item
        ? item.data
        : item
  ),
  totalCount: totalCount ?? 0,
});

// see: https://orm.drizzle.team/docs/guides/limit-offset-pagination
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ascLower = <T = string>(column: Column | SQL | SQL.Aliased) =>
  asc(sql<T>`LOWER(${column})`);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const withTotalCount = <T extends Table>(tbl: T) => ({
  ...getTableColumns(tbl),
  totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
});
