import {
  DynamoDBClient,
  PutItemCommand,
  PutItemInput,
} from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { config } from "../config/config.js";
import { formatError } from "../utils/errorFormatter.js";

interface DocumentReference {
  safeStorageKey: string;
  fileKind: string;
  streamId: string;
  subObjectId: string;
  fileName: string;
  version: number;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function dbServiceBuilder(dynamoDBClient: DynamoDBClient) {
  return {
    saveDocumentReference: async (
      reference: DocumentReference
    ): Promise<void> => {
      const item: DocumentReference = reference;
      const input: PutItemInput = {
        TableName: config.dbTableName,
        Item: {
          safeStorageKey: { S: item.safeStorageKey },
          fileKind: { S: item.fileKind },
          streamId: { S: item.streamId },
          subObjectId: { S: item.subObjectId },
          fileName: { S: item.fileName },
          version: { N: String(item.version) },
        },
        ReturnValues: "NONE",
      };

      const command = new PutItemCommand(input);

      try {
        await dynamoDBClient.send(command);
      } catch (error) {
        throw genericInternalError(
          `Error saving '${item.safeStorageKey}' on table '${
            config.dbTableName
          }': ${formatError(error)}`
        );
      }
    },
  };
}

export type DbServiceBuilder = ReturnType<typeof dbServiceBuilder>;
