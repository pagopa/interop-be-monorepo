import { sql, asc, SQL, Column, Table } from "drizzle-orm";
import type { Subquery } from "drizzle-orm/subquery";
import type { PgTable } from "drizzle-orm/pg-core/table";
import type { PgViewBase } from "drizzle-orm/pg-core/view-base";
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

type SelectionValue = Table | Column | SQL | SQL.Aliased;
type SelectionRecord = Record<string, SelectionValue>;

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
type SelectSource =
  | Subquery<string, Record<string, unknown>>
  | SQL
  | PgTable
  | PgViewBase;

type SelectFrom<TSelection extends SelectionRecord> = {
  orderBy: (...args: OrderByValue[]) => SelectFrom<TSelection>;
  limit: (value: number) => SelectFrom<TSelection>;
  offset: (value: number) => SelectFrom<TSelection>;
  leftJoin: (table: SelectSource, on: SQL) => SelectFrom<TSelection>;
  as: (alias: string) => SubqueryWithSelection<TSelection>;
};

type SelectBuilder<TSelection extends SelectionRecord> = {
  from: <TFrom extends SelectSource>(source: TFrom) => SelectFrom<TSelection>;
};

type DbSelectLike = {
  select: <TSelection extends SelectionRecord>(
    fields: TSelection
  ) => SelectBuilder<TSelection>;
};

type WithTotalCountSelection<TSelection extends SelectionRecord> =
  SubquerySelection<TSelection> & { totalCount: SQL.Aliased<number> };

export const withTotalCountSubquery = <TSelection extends SelectionRecord>(
  db: DbSelectLike,
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
    baseQuery: { as: (alias: string) => SubqueryWithSelection<TSelection> };
    selection: TSelection;
    orderBy:
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
    typeof orderBy === "function" ? orderBy(filtered) : orderBy;

  const pagedQueryWithOrder = Array.isArray(orderByValue)
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
