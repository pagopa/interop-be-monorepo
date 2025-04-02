import { z } from "zod";

export function generateMergeQuery<T extends z.ZodRawShape>(
  tableSchema: z.ZodObject<T>,
  schemaName: string,
  tableName: string,
  stagingTableName: string,
  column: keyof T,
  useCoalesce = false
): string {
  const keys = Object.keys(tableSchema.shape);

  const updateSet = keys
    .map((k) => {
      const col = String(k);
      return useCoalesce
        ? `${col} = COALESCE(source.${col}, ${schemaName}.${tableName}.${col})`
        : `${col} = source.${col}`;
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
