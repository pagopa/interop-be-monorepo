import { z } from "zod";

/**
 * Generates a MERGE SQL query
 *
 * @param tableSchema - A Zod object schema refering to the table model from which to extract the list of keys.
 * @param schemaName - The target db schema name.
 * @param tableName - The staging and target table name.
 * @param stagingSuffix - A suffix appended to the table name to indicate the staging table.
 * @param column - The key to be used for the ON condition (e.g., "correlation_id").
 * @returns The generated MERGE SQL query as a string.
 */
export function generateMergeQuery<T extends z.ZodRawShape>(
  tableSchema: z.ZodObject<T>,
  schemaName: string,
  tableName: string,
  stagingSuffix: string,
  column: keyof T
): string {
  const keys = Object.keys(tableSchema.shape);

  const updateSet = keys.map((k) => `${k} = source.${k}`).join(",\n    ");

  const columns = keys.join(", ");
  const values = keys.map((k) => `source.${k}`).join(", ");

  return `
  MERGE INTO ${schemaName}.${tableName}
  USING ${tableName}${stagingSuffix} AS source
  ON ${schemaName}.${tableName}.${String(column)} = source.${String(column)}
  WHEN MATCHED THEN
    UPDATE SET
      ${updateSet}
  WHEN NOT MATCHED THEN
    INSERT (${columns})
    VALUES (${values});
`;
}
