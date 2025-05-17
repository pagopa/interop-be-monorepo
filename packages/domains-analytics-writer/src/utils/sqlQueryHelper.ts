/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { z } from "zod";
import { ITask } from "pg-promise";
import {
  DbTable,
  DbTableReadModels,
  DeletingDbTable,
  DomainDbTable,
  DomainDbTableSchemas,
} from "../model/db.js";
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
export function getColumnName<T extends DbTable>(
  tableName: T
): (columnKey: string) => string {
  const table = DbTableReadModels[tableName] as unknown as Record<
    string,
    { name: string }
  >;
  return (columnKey: string) => table[columnKey]?.name ?? columnKey;
}

/**
 * Generates a MERGE SQL query to synchronize data from a staging table into a target table.
 *
 * @param tableSchema - A Zod schema representing the full shape of the table.
 * @param schemaName - The name of the target database schema.
 * @param tableName - The table name where the merge happens.
 * @param keysOn - The list of keys used for the `ON` condition of the MERGE.
 * @returns The generated SQL MERGE query as a string.
 */
export function generateMergeQuery<T extends z.ZodRawShape>(
  tableSchema: z.ZodObject<T>,
  schemaName: string,
  tableName: DomainDbTable,
  keysOn: Array<keyof T>
): string {
  const quoteColumn = (c: string) => `"${c}"`;
  const snakeCase = getColumnName(tableName);
  const keys = Object.keys(tableSchema.shape).map(snakeCase);

  const updateSet = keys
    .map((k) => `${quoteColumn(k)} = source.${quoteColumn(k)}`)
    .join(",\n      ");

  const colList = keys.map(quoteColumn).join(", ");
  const valList = keys.map((c) => `source.${quoteColumn(c)}`).join(", ");

  const onCondition = keysOn
    .map((k) => {
      const key = quoteColumn(snakeCase(String(k)));
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
  TT extends DomainDbTable,
  SN extends DeletingDbTable,
  DeleteKey extends keyof z.infer<DomainDbTableSchemas[TT]>
>(
  schemaName: string,
  targetTableName: TT,
  stagingTableName: SN,
  deleteKeysOn: DeleteKey[],
  useIdAsSourceDeleteKey: boolean = true
): string {
  const quoteColumn = (c: string) => `"${c}"`;
  const snakeCase = getColumnName(targetTableName);

  const onCondition = deleteKeysOn
    .map(
      (k) =>
        `${schemaName}.${targetTableName}.${quoteColumn(
          snakeCase(String(k))
        )} = source.${
          useIdAsSourceDeleteKey ? "id" : quoteColumn(snakeCase(String(k)))
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
  TN extends ReadonlyArray<DomainDbTable>,
  SN extends DeletingDbTable,
  DeleteKey extends keyof z.infer<DomainDbTableSchemas[TN[number]]>
>(
  t: ITask<unknown>,
  id: DeleteKey,
  deletingTargetTableNames: [...TN],
  deletingStagingTableName: SN
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
