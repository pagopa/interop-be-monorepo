/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { z } from "zod";
import { ITask } from "pg-promise";
import {
  DbTableNames,
  DbTableSchemas,
  DeletingDbTableConfig,
} from "../model/db.js";
import { config } from "../config/config.js";

/**
 * Generates a MERGE SQL query
 *
 * @param tableSchema - A Zod object schema refering to the table model from which to extract the list of keys.
 * @param targetTableName - The  target table name.
 * @param stagingTableName - The staging table.
 * @param keysOn - The column keys from the schema used in the ON condition of the MERGE.
 * @returns The generated MERGE SQL query as a string.
 */
export function generateMergeQuery<T extends z.ZodRawShape>(
  tableSchema: z.ZodObject<T>,
  schemaName: string,
  targetTableName: DbTableNames,
  stagingTableName: string,
  keysOn: Array<keyof T>
): string {
  const keys = Object.keys(tableSchema.shape);
  const quoteColumn = (c: string) => `"${c}"`;
  const updateSet = keys
    .map((k) => `${quoteColumn(k)} = source.${quoteColumn(k)}`)
    .join(",\n      ");

  const colList = keys.map(quoteColumn).join(", ");
  const valList = keys.map((c) => `source.${quoteColumn(c)}`).join(", ");

  const onCondition = keysOn
    .map(
      (k) =>
        `${schemaName}.${targetTableName}.${quoteColumn(
          String(k)
        )} = source.${quoteColumn(String(k))}`
    )
    .join(" AND ");

  return `
      MERGE INTO ${schemaName}.${targetTableName}
      USING ${stagingTableName} AS source
      ON ${onCondition}
      WHEN MATCHED
        AND source.metadata_version > ${schemaName}.${targetTableName}.metadata_version
      THEN
        UPDATE SET
          ${updateSet}
      WHEN NOT MATCHED THEN
        INSERT (${colList})
        VALUES (${valList});
    `;
}

export function generateMergeDeleteQuery<
  TT extends DbTableNames,
  SN extends keyof typeof DeletingDbTableConfig,
  DeleteKey extends keyof z.infer<DbTableSchemas[TT]>
>(
  schemaName: string,
  targetTableName: TT,
  stagingTableName: SN,
  deleteKeysOn: DeleteKey[],
  useIdAsSourceDeleteKey: boolean = true
): string {
  const quoteColumn = (c: string) => `"${c}"`;

  const onCondition = deleteKeysOn
    .map(
      (k) =>
        `${schemaName}.${targetTableName}.${quoteColumn(String(k))} = source.${
          useIdAsSourceDeleteKey ? "id" : quoteColumn(String(k))
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

export async function mergeDeletingCascadeById<
  TN extends ReadonlyArray<DbTableNames>,
  SN extends keyof typeof DeletingDbTableConfig,
  DeleteKey extends keyof z.infer<DbTableSchemas[TN[number]]>
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
