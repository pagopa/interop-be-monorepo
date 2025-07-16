import {
  DynamoDBClient,
  PutItemCommand,
  DeleteItemCommand,
  PutItemInput,
  DeleteItemInput,
} from "@aws-sdk/client-dynamodb";
import { Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";

interface SignatureReference {
  fileId: string;
  safeStorageId: string;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function dbServiceBuilder(client: DynamoDBClient, logger: Logger) {
  const dynamoDBClient = client;

  return {
    saveSignatureReference: async (
      reference: Omit<SignatureReference, "createdAt">
    ): Promise<void> => {
      const item: SignatureReference = {
        ...reference,
        createdAt: new Date().toISOString(),
      };

      const input: PutItemInput = {
        TableName: config.dbTableName,
        Item: {
          PK: { S: item.safeStorageId },
          safeStorageId: { S: item.safeStorageId },
          createdAt: { S: item.createdAt },
          status: { S: "PENDING_SIGNATURE" },
        },
        ReturnValues: "NONE",
      };

      const command = new PutItemCommand(input);

      try {
        await dynamoDBClient.send(command);
      } catch (error) {
        logger.error(`Error saving '${item.fileId}': ${error}`);
        throw error;
      }
    },

    removeSignatureReference: async (
      fileId: string,
      safeStorageId: string
    ): Promise<void> => {
      const input: DeleteItemInput = {
        TableName: config.dbTableName,
        Key: {
          PK: { S: safeStorageId },
        },
        ReturnValues: "NONE",
      };

      const command = new DeleteItemCommand(input);

      try {
        await dynamoDBClient.send(command);
      } catch (error) {
        logger.error(`Error removing '${fileId}': ${error}`);
        throw error;
      }
    },
  };
}

export type DbServiceBuilder = ReturnType<typeof dbServiceBuilder>;
