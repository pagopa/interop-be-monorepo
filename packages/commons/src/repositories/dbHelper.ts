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
