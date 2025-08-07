import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { config } from "../config/config.js";

export function dbServiceBuilder(dynamoDBClient: DynamoDBClient): {
  deleteFromDynamo: (id: string) => Promise<void>;
} {
  return {
    deleteFromDynamo: async (id: string): Promise<void> => {
      const command: DeleteItemCommand = new DeleteItemCommand({
        TableName: config.dbTableName,
        Key: {
          safeStorageId: { S: id },
        },
      });

      try {
        await dynamoDBClient.send(command);
      } catch (error) {
        throw genericInternalError(`Error deleting '${id}': ${error}`);
      }
    },
  };
}

export type DbServiceBuilder = ReturnType<typeof dbServiceBuilder>;
