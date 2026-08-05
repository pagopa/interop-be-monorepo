import { sql, asc, SQL, Column, Table } from "drizzle-orm";
import { AnyPgTable, PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { ListResult } from "pagopa-interop-models";

export const createListResult = <T>(
  items: T[],
  totalCount?: number
): ListResult<T> => ({
  results: items,
  totalCount: totalCount ?? 0,
});

// Resolves the total count of an offset-paginated query.
//
// `withTotalCount` relies on `COUNT(*) OVER()`, a window function whose value
// only exists on the returned rows. When `offset` is past the last row the page
// comes back empty, so there is no row to read the window value from and the
// count would wrongly collapse to 0. In that case we run an independent
// `COUNT(*)` using the same filter; otherwise we reuse the value already carried
// by the page rows (no extra query).
export const resolveTotalCount = async <
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
>(
  pageRows: Array<{ totalCount: number }>,
  db: PgDatabase<TQueryResult, TFullSchema>,
  from: AnyPgTable,
  where: SQL | undefined
): Promise<number> => {
  const [firstRow] = pageRows;
  if (firstRow !== undefined) {
    return firstRow.totalCount;
  }
  const [countRow] = await db
    .select({ totalCount: sql<number>`count(*)`.mapWith(Number) })
    .from(from)
    .where(where);
  return countRow?.totalCount ?? 0;
};

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

// Escapes SQL LIKE metacharacters (%, _, \) so they are treated as literals.
// Must be used on user input before embedding it in an ILIKE pattern.
// Kept separate from ilikeEscaped because the caller decides where to place
// the wildcards (e.g. `%${escapeSqlLike(val)}%` for contains, no % for exact).
// Merging escape + ilike into one function would escape the caller's own % wildcards.
export const escapeSqlLike = (value: string): string =>
  value.replace(/[\\%_]/g, "\\$&");

// Performs an ILIKE comparison with the ESCAPE clause, which tells Postgres
// to interpret backslashes produced by escapeSqlLike as escape characters.
// Without ESCAPE '\\', the \% and \_ sequences would not be treated as literals.
export const ilikeEscaped = (
  column: Column | SQL.Aliased,
  pattern: string
): SQL => sql`${column} ILIKE ${pattern} ESCAPE '\\'`;
