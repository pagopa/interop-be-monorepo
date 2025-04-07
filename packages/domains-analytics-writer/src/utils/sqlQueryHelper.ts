import { z } from "zod";

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
