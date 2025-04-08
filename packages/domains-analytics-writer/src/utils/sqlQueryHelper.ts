import { z } from "zod";
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
