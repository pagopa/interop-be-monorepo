/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-params */
/* eslint-disable functional/immutable-data */
import { z } from "zod";
import { ColumnSet, IColumnDescriptor, IMain, ITask } from "pg-promise";
import {
  DbTable,
  DbTableReadModels,
  DeletingDbTable,
  DomainDbTable,
  DomainDbTableSchemas,
  PartialDbTable,
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
 * @param stagingPartialTableName - Optional staging table name for partial upserts; if provided,
 * only the columns present in this table will be merged (e.g., for updating specific fields).
 * @returns The generated MERGE SQL query as a string.
 */
export function generateMergeQuery<T extends z.ZodRawShape>(
  tableSchema: z.ZodObject<T>,
  schemaName: string,
  tableName: DomainDbTable,
  keysOn: Array<keyof T>,
  stagingPartialTableName?: PartialDbTable
): string {
  const quoteColumn = (c: string) => `"${c}"`;
  const snakeCaseMapper = getColumnNameMapper(tableName);
  const keys = Object.keys(tableSchema.shape).map(snakeCaseMapper);

  const colList = keys.map(quoteColumn).join(", ");
  const valList = keys.map((c) => `source.${quoteColumn(c)}`).join(", ");

  const onCondition = keysOn
    .map((k) => {
      const columnName = quoteColumn(snakeCaseMapper(String(k)));
      const targetColumn = `${schemaName}.${tableName}.${columnName}`;
      const sourceColumn = columnName;
      return `${targetColumn} = source.${sourceColumn}`;
    })
    .join(" AND ");

  const snakeCaseKeysOn = keysOn.map((k) => snakeCaseMapper(String(k)));

  const updateSet = keys
    .filter((field) => !snakeCaseKeysOn.includes(field))
    .map((k) => `${quoteColumn(k)} = source.${quoteColumn(k)}`)
    .join(",\n      ");

  const stagingTableName = `${stagingPartialTableName || tableName}_${
    config.mergeTableSuffix
  }`;

  return `
      MERGE INTO ${schemaName}.${tableName}
      USING ${stagingTableName} AS source
      ON ${onCondition}
      WHEN MATCHED THEN
        UPDATE SET ${updateSet}
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
 * @param physicalDelete - If true, executes a physical DELETE; otherwise, updates the `deleted` flag (default: true).
 * @param additionalsKeyToUpdate - Additional column keys to include in the UPDATE aside from `deleted`. Defaults to none.
 * @returns A MERGE SQL query string to perform a logical delete.
 */
export function generateMergeDeleteQuery<
  TargetTable extends DomainDbTable,
  StagingTable extends DeletingDbTable,
  ColumnKeys extends keyof z.infer<DomainDbTableSchemas[TargetTable]>
>(
  schemaName: string,
  targetTableName: TargetTable,
  stagingTableName: StagingTable,
  deleteKeysOn: ColumnKeys[],
  useIdAsSourceDeleteKey: boolean = true,
  physicalDelete: boolean = true,
  additionalKeysToUpdate?: ColumnKeys[]
): string {
  const quoteColumn = (c: string) => `"${c}"`;
  const snakeCaseMapper = getColumnNameMapper(targetTableName);

  const onCondition = deleteKeysOn
    .map((k) => {
      const columnName = quoteColumn(snakeCaseMapper(String(k)));
      const targetColumn = `${schemaName}.${targetTableName}.${columnName}`;
      const sourceColumn = useIdAsSourceDeleteKey ? "id" : columnName;
      return `${targetColumn} = source.${sourceColumn}`;
    })
    .join(" AND ");

  if (physicalDelete) {
    return `
      DELETE FROM ${schemaName}.${targetTableName}
      USING ${stagingTableName}_${config.mergeTableSuffix} AS source
      WHERE ${onCondition};
    `.trim();
  } else {
    const fieldsToUpdate = [
      "deleted",
      ...(additionalKeysToUpdate?.map(String) ?? []),
    ];
    const updateSet = fieldsToUpdate
      .map((field) => `${field} = source.${field}`)
      .join(",\n      ");

    return `
      UPDATE ${schemaName}.${targetTableName}
      SET ${updateSet}
      FROM ${stagingTableName}_${config.mergeTableSuffix} AS source
      WHERE ${onCondition};
    `.trim();
  }
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
  deletingStagingTableName: StagingTable,
  isPhysicalDelete: boolean = false
): Promise<void> {
  const useIdAsSourceDeleteKey = true;

  for (const deletingTargetTableName of deletingTargetTableNames) {
    const mergeQuery = generateMergeDeleteQuery(
      config.dbSchemaName,
      deletingTargetTableName,
      deletingStagingTableName,
      [id],
      useIdAsSourceDeleteKey,
      isPhysicalDelete
    );
    await t.none(mergeQuery);
  }
}

const sanitizeColumnValue = (s: string): string => s.replace(/\\$/, "\\\\");

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
      typeof source[prop] === "string"
        ? sanitizeColumnValue(source[prop])
        : source[prop],
  }));

  return new pgp.helpers.ColumnSet(columns, {
    table: { table: `${tableName}_${config.mergeTableSuffix}` },
  });
};

/**
 * Generates SQL to remove outdated or duplicate rows from the staging table.
 * It returns two DELETE statements:
 *
 * 1. Deletes rows in the staging table that have the same key columns as another
 *    row in the staging table but a lower `metadata_version`.
 * 2. Deletes rows in the staging table that are older than the corresponding rows
 *    already present in the target table.
 * 3. Deletes duplicate rows in the staging table that share the same key columns,
 *    only after removing minor meta_version, keeping only the most recent one according
 *    to `_seq` (identity column).
 *
 * @param tableName - The base table name.
 * @param keyConditions - Array of column keys used to match records for deletion.
 * @param partialTableName - Staging table name for partial upsert.
 * @returns A SQL string containing two DELETE statements to perform staging cleanup.
 */
export function generateStagingDeleteQuery<
  T extends DomainDbTable,
  ColumnKeys extends keyof z.infer<DomainDbTableSchemas[T]>
>(
  tableName: T,
  keyConditions: ColumnKeys[],
  partialTableName?: PartialDbTable
): string {
  const snakeCaseMapper = getColumnNameMapper(tableName);
  const stagingTableName = `${partialTableName ?? tableName}_${
    config.mergeTableSuffix
  }`;

  const whereCondition = keyConditions
    .map((key) => {
      const columnName = snakeCaseMapper(String(key));
      return `${stagingTableName}.${columnName} = b.${columnName}`;
    })
    .join("\n  AND ");

  const partitionKey = keyConditions
    .map((key) => snakeCaseMapper(String(key)))
    .join(", ");

  return `
    DELETE FROM ${stagingTableName}
    USING ${stagingTableName} b
    WHERE ${whereCondition}
      AND ${stagingTableName}.metadata_version < b.metadata_version;

    DELETE FROM ${stagingTableName}
    USING ${config.dbSchemaName}.${tableName} b
    WHERE ${whereCondition}
      AND ${stagingTableName}.metadata_version < b.metadata_version;

    DELETE FROM ${stagingTableName}
    USING (
      SELECT _seq FROM (
        SELECT _seq,
               ROW_NUMBER() OVER (
                 PARTITION BY ${partitionKey}
                 ORDER BY metadata_version DESC, _seq
               ) AS rn
        FROM ${stagingTableName}
      ) sub
      WHERE rn > 1
    ) d
    WHERE ${stagingTableName}._seq = d._seq;
  `.trim();
}

/**
 * Purge obsolete rows in target tables by deleting based on staging data.
 *
 * This operation deletes any row in each target table that has the same key as a staging row
 * but a lower metadata_version, ensuring outdated records are removed.
 *
 * @param t - The pg-promise transaction object.
 * @param id - The key to match rows on during the delete.
 * @param targetTableNames - A list of target table names to apply the delete.
 * @param stagingTableName - The name of the staging table containing columns used for deleting condition.
 */
export async function cleaningTargetTables<
  TargetTable extends ReadonlyArray<DomainDbTable>,
  StagingTable extends DomainDbTable | DeletingDbTable,
  DeleteKey extends keyof z.infer<DomainDbTableSchemas[TargetTable[number]]>
>(
  t: ITask<unknown>,
  id: DeleteKey,
  targetTableNames: TargetTable,
  stagingTableName: StagingTable
) {
  const quoteColumn = (c: string) => `"${c}"`;
  for (const targetTableName of targetTableNames) {
    const snakeCaseMapper = getColumnNameMapper(targetTableName);

    const whereCondition = `${
      config.dbSchemaName
    }.${targetTableName}.${quoteColumn(
      snakeCaseMapper(String(id))
    )} = source.id`;

    const deleteQuery = `
    DELETE FROM ${config.dbSchemaName}.${targetTableName}
    USING ${stagingTableName}_${config.mergeTableSuffix} AS source
    WHERE ${whereCondition}
      AND ${config.dbSchemaName}.${targetTableName}.metadata_version < source.metadata_version
    `.trim();

    await t.none(deleteQuery);
  }
}

/**
 * Removes duplicate objects from an array based on a set of key fields.
 *
 * @template T - The Zod schema shape defining the object structure.
 * @param items - The array of objects to deduplicate.
 * @param schema - The Zod schema used to validate the unique keys.
 * @param keys - The list of keys used to determine uniqueness.
 * @returns A new array containing only distinct items based on the provided keys.
 */
export const distinctByKeys = <T extends z.ZodRawShape>(
  items: Array<z.infer<z.ZodObject<T>>>,
  schema: z.ZodObject<T>,
  keys: Array<keyof z.infer<z.ZodObject<T>>>
): Array<z.infer<z.ZodObject<T>>> => {
  const parsedItems = items.map((item) => schema.parse(item));
  const uniqueKeySet = new Set<string>();
  const deduplicatedItems: typeof parsedItems = [];

  for (const item of parsedItems) {
    const compositeKey = keys.map((key) => String(item[key])).join("|");
    if (!uniqueKeySet.has(compositeKey)) {
      uniqueKeySet.add(compositeKey);
      deduplicatedItems.push(item);
    }
  }

  return deduplicatedItems;
};
