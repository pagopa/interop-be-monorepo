import { z } from "zod";
import { genericInternalError } from "pagopa-interop-models";
import { ITask } from "pg-promise";
import { config } from "../config/config.js";
/**
 * Generates a MERGE SQL query
 *
 * @param tableSchema - A Zod object schema refering to the table model from which to extract the list of keys.
 * @param schemaName - The target db schema name.
 * @param tableName - The  target table name.
 * @param stagingTableName - The staging table.
 * @param column - The single column key from the schema used in the ON condition of the MERGE.
 * @returns The generated MERGE SQL query as a string.
 */
export function generateMergeQuery<T extends z.ZodRawShape>(
  tableSchema: z.ZodObject<T>,
  schemaName: string,
  tableName: string,
  stagingTableName: string,
  column: keyof T
): string {
  const keys = Object.keys(tableSchema.shape);

  const updateSet = keys
    .map((k) => {
      const col = String(k);
      return `${col} = source.${col}`;
    })
    .join(",\n      ");

  const columns = keys.join(", ");
  const values = keys.map((k) => `source.${k}`).join(", ");
  return `
  MERGE INTO ${schemaName}.${tableName}
  USING ${stagingTableName} AS source
  ON ${schemaName}.${tableName}.${String(column)} = source.${String(column)}
  WHEN MATCHED THEN
    UPDATE SET
      ${updateSet}
  WHEN NOT MATCHED THEN
    INSERT (${columns})
    VALUES (${values});
`;
}

/**
 * Generates a SQL MERGE query to update records in a target table based on a staging table.
 *
 * It updates the `deletingKey` field and sets the `deleted` flag based on matching records from the staging table.
 *
 * @param schemaName - The name of the schema containing the target table
 * @param tableName - The name of the target table to update
 * @param stagingTableName - The name of the staging table containing the updated data
 * @param deletingKey - The key used to match records between the tables
 * @returns A SQL MERGE query string
 */
export function generateMergeDeleteQuery(
  schemaName: string,
  tableName: string,
  stagingTableName: string,
  deletingKey: string
): string {
  const updateSet = `${deletingKey} = source.id,
   deleted = source.deleted`;

  return `
  MERGE INTO ${schemaName}.${tableName}
  USING ${stagingTableName} AS source
  ON ${schemaName}.${tableName}.${deletingKey} = source.id
  WHEN MATCHED THEN
    UPDATE SET
      ${updateSet};
`;
}

export async function mergeDeletingById(
  t: ITask<unknown>,
  id: string,
  deletingTableNames: string[],
  targetTableDeleting: string
): Promise<void> {
  try {
    for (const deletingTableName of deletingTableNames) {
      const mergeQuery = generateMergeDeleteQuery(
        config.dbSchemaName,
        deletingTableName,
        targetTableDeleting,
        id
      );
      await t.none(mergeQuery);
    }
  } catch (error: unknown) {
    throw genericInternalError(
      `Error merging staging table ${targetTableDeleting}: ${error}`
    );
  }
}
