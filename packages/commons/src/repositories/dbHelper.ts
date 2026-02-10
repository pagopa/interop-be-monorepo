import { sql, asc, SQL, Column, Table } from "drizzle-orm";
import type { Subquery } from "drizzle-orm/subquery";
import { ListResult } from "pagopa-interop-models";

export const createListResult = <T>(
  items: T[],
  totalCount?: number
): ListResult<T> => ({
  results: items,
  totalCount: totalCount ?? 0,
});

export const lowerCase = (column: Column | SQL | SQL.Aliased): SQL =>
  sql<string>`LOWER(${column})`;

// see: https://orm.drizzle.team/docs/guides/limit-offset-pagination
export const ascLower = (column: Column | SQL | SQL.Aliased): SQL =>
  asc(lowerCase(column));

export const withTotalCount = <
  P extends Record<string, Table | Column | SQL | SQL.Aliased>
>(
  projection: P
): P & { totalCount: SQL.Aliased<number> } => ({
  ...projection,
  totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
});

export type SelectionValue = Table | Column | SQL | SQL.Aliased;
export type SelectionRecord = Record<string, SelectionValue>;

type SubquerySelection<TSelection extends SelectionRecord> = {
  [K in keyof TSelection]: TSelection[K];
};

type SubqueryWithSelection<TSelection extends SelectionRecord> = Subquery<
  string,
  Record<string, unknown>
> &
  SubquerySelection<TSelection>;

export const buildTotalCountQuery = <TSelection extends SelectionRecord>(
  baseQuery: { as: (alias: string) => SubqueryWithSelection<TSelection> },
  alias = "count_subquery"
): {
  countColumn: SQL.Aliased<number>;
  subquery: SubqueryWithSelection<TSelection>;
} => ({
  countColumn: sql`COUNT(*)`.mapWith(Number).as("totalCount"),
  subquery: baseQuery.as(alias),
});

const mapSelectionFromSubquery = <TSelection extends SelectionRecord>(
  subquery: SubqueryWithSelection<TSelection>,
  selection: TSelection
): SubquerySelection<TSelection> =>
  Object.fromEntries(
    Object.keys(selection).map((key) => [key, subquery[key]])
  ) as SubquerySelection<TSelection>;

type OrderByValue = Column | SQL | SQL.Aliased;
type OrderByInput = OrderByValue | OrderByValue[];

type WithTotalCountSelection<TSelection extends SelectionRecord> =
  SubquerySelection<TSelection> & { totalCount: SQL.Aliased<number> };

export const withTotalCountSubquery = <TSelection extends SelectionRecord>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  {
    baseQuery,
    selection,
    orderBy,
    limit,
    offset,
    alias = "subquery",
    filteredAlias = "filtered",
    pagedAlias = "paged",
    countAlias = "total_count",
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    baseQuery: any;
    selection: TSelection;
    orderBy?:
      | OrderByInput
      | ((subquery: SubqueryWithSelection<TSelection>) => OrderByInput);
    limit: number;
    offset: number;
    alias?: string;
    filteredAlias?: string;
    pagedAlias?: string;
    countAlias?: string;
  }
): SubqueryWithSelection<WithTotalCountSelection<TSelection>> => {
  const { countColumn, subquery: filtered } = buildTotalCountQuery(
    baseQuery,
    filteredAlias
  );

  const pagedQuery = db
    .select(mapSelectionFromSubquery(filtered, selection))
    .from(filtered);

  const orderByValue =
    typeof orderBy === "function"
      ? orderBy(filtered as SubqueryWithSelection<TSelection>)
      : orderBy;

  const pagedQueryWithOrder =
    orderByValue === undefined ||
    (Array.isArray(orderByValue) && orderByValue.length === 0)
      ? pagedQuery
      : Array.isArray(orderByValue)
      ? pagedQuery.orderBy(...orderByValue)
      : pagedQuery.orderBy(orderByValue);

  const paged = pagedQueryWithOrder.limit(limit).offset(offset).as(pagedAlias);
  const totalCountSubquery = db
    .select({ totalCount: countColumn })
    .from(filtered)
    .as(countAlias);

  const selectionWithCount: WithTotalCountSelection<TSelection> = {
    ...mapSelectionFromSubquery(paged, selection),
    totalCount: totalCountSubquery.totalCount,
  };

  return db
    .select(selectionWithCount)
    .from(totalCountSubquery)
    .leftJoin(paged, sql`true`)
    .as(alias);
};

export const filterNonNullAndCast = <T extends Record<string, unknown>>(
  arr: T[],
  key: keyof T
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] => arr.filter((row) => row[key] !== null) as any[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const dynamicSelect = (db: any, selection: SelectionRecord): any =>
  db.select(selection);

export const omitFromRow = <T extends Record<string, unknown>>(
  row: T,
  ...keys: string[]
): // eslint-disable-next-line @typescript-eslint/no-explicit-any
any => {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    if (!keys.includes(k)) {
      // eslint-disable-next-line functional/immutable-data
      result[k] = v;
    }
  }
  return result;
};
