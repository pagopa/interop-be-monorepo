import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AnyPgTable } from "drizzle-orm/pg-core";

import {
  DeleteItemCommand,
  type DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { sql } from "drizzle-orm";
import { TokenGenerationReadModelDbConfig } from "pagopa-interop-commons";

export async function resetDynamoTables(
  dynamoClient: DynamoDBClient,
  config: TokenGenerationReadModelDbConfig
): Promise<void> {
  const keyColumns = {
    tokenGenerationReadModelTableNamePlatform: "PK",
    tokenGenerationReadModelTableNameTokenGeneration: "PK",
  } satisfies Record<keyof TokenGenerationReadModelDbConfig, string>;

  await Promise.all(
    Object.keys(keyColumns)
      .filter(
        (key): key is keyof typeof keyColumns & string => key in keyColumns
      )
      .map(async (key) => {
        const tableName = config[key];
        const keyColumn = keyColumns[key];
        const { Items = [] } = await dynamoClient.send(
          new ScanCommand({
            ProjectionExpression: keyColumn,
            TableName: tableName,
          })
        );
        await Promise.all(
          Items.flatMap((item) => {
            const keyValue = item[keyColumn];
            if (keyValue === undefined) return [];
            return [
              dynamoClient.send(
                new DeleteItemCommand({
                  Key: { [keyColumn]: keyValue },
                  TableName: tableName,
                })
              ),
            ];
          })
        );
      })
  );
}

export async function resetTestDatabase(
  db: NodePgDatabase,
  ...tables: AnyPgTable[]
): Promise<void> {
  if (tables.length === 0) {
    return;
  }

  await db.execute(
    sql`TRUNCATE TABLE ${sql.join(tables, sql.raw(", "))} RESTART IDENTITY CASCADE`
  );
}
