import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { config } from "../config/config.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function dbServiceBuilder(dynamoDBClient: DynamoDBClient) {
  return {
    deleteFromDynamo: async (id: string): Promise<void> => {
      const command: DeleteItemCommand = new DeleteItemCommand({
        TableName: config.dbTableName,
        Key: { id: { S: id } },
      });

      try {
        await dynamoDBClient.send(command);
      } catch (error) {
        throw genericInternalError(`Error saving '${id}': ${error}`);
      }
    },
  };
}

export type DbServiceBuilder = ReturnType<typeof dbServiceBuilder>;
