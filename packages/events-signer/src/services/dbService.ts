import {
  DynamoDBClient,
  PutItemCommand,
  PutItemInput,
} from "@aws-sdk/client-dynamodb";
import { Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";

interface SignatureReference {
  safeStorageId: string;
  fileKind: string;
  fileName: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function dbServiceBuilder(
  dynamoDBClient: DynamoDBClient,
  logger: Logger
) {
  return {
    saveSignatureReference: async (
      reference: SignatureReference
    ): Promise<void> => {
      const item: SignatureReference = reference;

      const input: PutItemInput = {
        TableName: config.dbTableName,
        Item: {
          PK: { S: item.safeStorageId },
          safeStorageId: { S: item.safeStorageId },
          fileKind: { S: item.fileKind },
          fileName: { S: item.fileName },
        },
        ReturnValues: "NONE",
      };

      const command = new PutItemCommand(input);

      try {
        await dynamoDBClient.send(command);
      } catch (error) {
        logger.error(`Error saving '${item.safeStorageId}': ${error}`);
        throw error;
      }
    },
  };
}

export type DbServiceBuilder = ReturnType<typeof dbServiceBuilder>;
