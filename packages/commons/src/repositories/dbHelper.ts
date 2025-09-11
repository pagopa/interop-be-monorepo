/* eslint-disable functional/immutable-data */
import {
  sql,
  asc,
  SQL,
  Column,
  Table,
  desc,
  getTableColumns,
} from "drizzle-orm";
import { toCamelCase } from "drizzle-orm/casing";
import { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { genericInternalError, ListResult } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { z } from "zod";

export const sortDirection = {
  desc: "desc",
  asc: "asc",
} as const;
export const SortDirection = z.enum([
  Object.values(sortDirection)[0],
  ...Object.values(sortDirection).slice(1),
]);
export type SortDirection = z.infer<typeof SortDirection>;

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

export const descLower = (column: Column): SQL => desc(lowerCase(column));

export const withTotalCount = <
  P extends Record<string, Table | Column | SQL | SQL.Aliased>
>(
  projection: P
): P & { totalCount: SQL.Aliased<number> } => ({
  ...projection,
  totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
});

export const createOrderByClauses = ({
  table,
  sortColumns,
  directions,
  defaultSortColumn,
}: {
  table: PgTable;
  sortColumns: string | undefined;
  directions: string | undefined;
  defaultSortColumn: PgColumn;
}): SQL[] => {
  const splitSortColumns = sortColumns ? sortColumns.split(",") : [];
  const splitDirections = directions ? directions.split(",") : [];

  const defaultSortColumnName = toCamelCase(defaultSortColumn.name);
  if (!splitSortColumns.includes(defaultSortColumnName)) {
    splitSortColumns.push(defaultSortColumnName);
    splitDirections.push(sortDirection.asc);
  }

  if (splitSortColumns.length !== splitDirections.length) {
    throw genericInternalError(
      `Invalid sort columns ${sortColumns} and directions ${directions}. They must have the same number of elements.`
    );
  }

  const tableColumns = getTableColumns(table);

  function isValidColumn(
    sortColumn: string | undefined,
    columns: typeof tableColumns
  ): sortColumn is keyof typeof tableColumns {
    return !!sortColumn && sortColumn in columns;
  }

  // eslint-disable-next-line functional/no-let
  const orderClauses: SQL[] = [];

  // eslint-disable-next-line functional/no-let
  for (let i = 0; i < splitSortColumns.length; i++) {
    const sortColumn = splitSortColumns[i];
    const direction = SortDirection.parse(splitDirections[i]);

    if (!isValidColumn(sortColumn, tableColumns)) {
      throw genericInternalError(`Invalid sort column ${sortColumn}`);
    }

    const column = tableColumns[sortColumn];
    orderClauses.push(
      match(SortDirection.parse(direction))
        .with(sortDirection.asc, () => ascLower(column))
        .with(sortDirection.desc, () => descLower(column))
        .exhaustive()
    );
  }
  return orderClauses;
};
