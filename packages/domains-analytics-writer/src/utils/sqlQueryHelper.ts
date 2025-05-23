/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { z } from "zod";
import { ColumnSet, IColumnDescriptor, IMain, ITask } from "pg-promise";
import {
  DbTable,
  DbTableReadModels,
  DeletingDbTable,
  DomainDbTable,
  DomainDbTableSchemas,
} from "../model/db/index.js";
import { config } from "../config/config.js";

/**
 * Given a table key from `DbTableReadModels`, returns a function that
 * maps a key column from `camelCase` to the actual SQL column names
 * `snake_case` defined in the corresponding Drizzle readModel tables.
 *
 * @param tableName  A key in `DbTableReadModels` (e.g. `"eserviceId"`, etc.)
 * @returns A mapper `(columnKey: string) => string` that returns the actual
 * SQL column name (e.g. "eservice_id") or falls back to the original key.
 */
export function getColumnNameMapper<T extends DbTable>(
  tableName: T
): (columnKey: string) => string {
  const table = DbTableReadModels[tableName] as unknown as Record<
    string,
    { name: string }
  >;
  return (columnKey: string) => table[columnKey]?.name ?? columnKey;
}

/**
 * Generates a MERGE SQL query
 *
 * @param tableSchema - A Zod object schema refering to the table model from which to extract the list of keys.
 * @param schemaName - The target db schema name.
 * @param tableName - The  target table name.
 * @param keysOn - The column keys from the schema used in the ON condition of the MERGE.
 * @returns The generated MERGE SQL query as a string.
 */
export function generateMergeQuery<T extends z.ZodRawShape>(
  tableSchema: z.ZodObject<T>,
  schemaName: string,
  tableName: DomainDbTable,
  keysOn: Array<keyof T>
): string {
  const quoteColumn = (c: string) => `"${c}"`;
  const snakeCaseMapper = getColumnNameMapper(tableName);
  const keys = Object.keys(tableSchema.shape).map(snakeCaseMapper);

  const updateSet = keys
    .map((k) => `${quoteColumn(k)} = source.${quoteColumn(k)}`)
    .join(",\n      ");

  const colList = keys.map(quoteColumn).join(", ");
  const valList = keys.map((c) => `source.${quoteColumn(c)}`).join(", ");

  const onCondition = keysOn
    .map((k) => {
      const key = quoteColumn(snakeCaseMapper(String(k)));
      return `${schemaName}.${tableName}.${key} = source.${key}`;
    })
    .join(" AND ");
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return `
      MERGE INTO ${schemaName}.${tableName}
      USING ${stagingTableName} AS source
      ON ${onCondition}
      WHEN MATCHED
        AND source.metadata_version > ${schemaName}.${tableName}.metadata_version
      THEN
        UPDATE SET
          ${updateSet}
      WHEN NOT MATCHED THEN
        INSERT (${colList})
        VALUES (${valList});
    `;
}

/**
 * Generates a simplified MERGE query to update the `deleted` flag
 * for matching rows between a target table and a staging table.
 *
 * @param schemaName - The database schema name.
 * @param targetTableName - The target table to update.
 * @param stagingTableName - The temporary staging table used as a source.
 * @param deleteKeysOn - Keys used to match records between the tables.
 * @param useIdAsSourceDeleteKey - Whether to always use "id" as the source key (default: true).
 * @returns A MERGE SQL query string to perform a logical delete.
 */
export function generateMergeDeleteQuery<
  TargetTable extends DomainDbTable,
  StagingTable extends DeletingDbTable,
  DeleteKey extends keyof z.infer<DomainDbTableSchemas[TargetTable]>
>(
  schemaName: string,
  targetTableName: TargetTable,
  stagingTableName: StagingTable,
  deleteKeysOn: DeleteKey[],
  useIdAsSourceDeleteKey: boolean = true
): string {
  const quoteColumn = (c: string) => `"${c}"`;
  const snakeCaseMapper = getColumnNameMapper(targetTableName);

  const onCondition = deleteKeysOn
    .map(
      (k) =>
        `${schemaName}.${targetTableName}.${quoteColumn(
          snakeCaseMapper(String(k))
        )} = source.${
          useIdAsSourceDeleteKey
            ? "id"
            : quoteColumn(snakeCaseMapper(String(k)))
        }`
    )
    .join(" AND ");

  return `
      MERGE INTO ${schemaName}.${targetTableName}
      USING ${stagingTableName}_${config.mergeTableSuffix} AS source
        ON ${onCondition}
      WHEN MATCHED THEN
        UPDATE SET deleted = source.deleted;
    `.trim();
}

/**
 * Performs a cascading logical delete (`deleted = true`) across multiple target tables
 * by generating and executing MERGE queries based on a shared `id` key.
 *
 * @param t - The pg-promise transaction object.
 * @param id - The key to match rows on during the delete cascade (typically "id").
 * @param deletingTargetTableNames - A list of target table names to apply the delete.
 * @param deletingStagingTableName - The name of the staging table containing `id` and `deleted` columns.
 */
export async function mergeDeletingCascadeById<
  TargetTable extends ReadonlyArray<DomainDbTable>,
  StagingTable extends DeletingDbTable,
  DeleteKey extends keyof z.infer<DomainDbTableSchemas[TargetTable[number]]>
>(
  t: ITask<unknown>,
  id: DeleteKey,
  deletingTargetTableNames: [...TargetTable],
  deletingStagingTableName: StagingTable
): Promise<void> {
  for (const deletingTargetTableName of deletingTargetTableNames) {
    const mergeQuery = generateMergeDeleteQuery(
      config.dbSchemaName,
      deletingTargetTableName,
      deletingStagingTableName,
      [id]
    );
    await t.none(mergeQuery);
  }
}

export type ColumnValue = string | number | Date | undefined | null | boolean;

/**
 * Builds a pg-promise ColumnSet for performing bulk insert/update operations on a given table.
 *
 * This function maps the fields of a Zod schema to database columns using a snake_case naming strategy,
 * which allows pg-promise to efficiently generate SQL for bulk operations.
 *
 * @template T - The Zod object schema shape describing the table structure.
 * @param pgp - The pg-promise main instance used to create the ColumnSet.
 * @param tableName - The logical name of the database table (without suffixes).
 * @param schema - The Zod schema representing the shape of the data to persist.
 * @returns A pg-promise ColumnSet object with mapped columns for bulk operations.
 */
export const buildColumnSet = <T extends z.ZodRawShape>(
  pgp: IMain,
  tableName: DbTable,
  schema: z.ZodObject<T>
): ColumnSet<z.infer<typeof schema>> => {
  const snakeCaseMapper = getColumnNameMapper(tableName);
  const keys = Object.keys(schema.shape) as Array<keyof z.infer<typeof schema>>;

  const columns = keys.map((prop) => ({
    name: snakeCaseMapper(String(prop)),
    init: ({ source }: IColumnDescriptor<z.infer<typeof schema>>) =>
      source[prop],
  }));

  return new pgp.helpers.ColumnSet(columns, {
    table: { table: `${tableName}_${config.mergeTableSuffix}` },
  });
};
