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
// Overload
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ascLower<T = string>(column: Column | SQL | SQL.Aliased): SQL;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ascLower<T = string>(
  ...columns: Array<Column | SQL | SQL.Aliased>
): SQL;

// Implementation
export function ascLower<T = string>(
  ...columns: Array<Column | SQL | SQL.Aliased>
): SQL {
  //   asc(sql<T>`LOWER(${column})`);
  return asc(sql<T>`LOWER(${columns.join(", ")})`);
  /*
  const expressions = columns.map((col) => sql<T>`LOWER(${col})`);
  const combined = sql.join(expressions, sql.raw(", "));
  return asc(combined);
  */
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const withTotalCount = <T extends Table>(tbl: T) => ({
  ...getTableColumns(tbl),
  totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
});
