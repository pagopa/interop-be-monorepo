import {
  DynamoDBClient,
  PutItemCommand,
  PutItemInput,
} from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { config } from "../config/config.js";
import { formatError } from "../utils/errorFormatter.js";

interface SignatureReference {
  safeStorageId: string;
  fileKind: string;
  fileName: string;
  correlationId: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function dbServiceBuilder(dynamoDBClient: DynamoDBClient) {
  return {
    saveSignatureReference: async (
      reference: SignatureReference
    ): Promise<void> => {
      const item: SignatureReference = reference;
      const input: PutItemInput = {
        TableName: config.signatureReferencesTableName,
        Item: {
          safeStorageId: { S: item.safeStorageId },
          correlationId: { S: item.correlationId },
          fileKind: { S: item.fileKind },
          fileName: { S: item.fileName },
        },
        ReturnValues: "NONE",
      };

      const command = new PutItemCommand(input);

      try {
        await dynamoDBClient.send(command);
      } catch (error) {
        throw genericInternalError(
          `Error saving record on table: '${
            config.signatureReferencesTableName
          }' id: '${item.safeStorageId}': ${formatError(error)}`
        );
      }
    },
  };
}

export type DbServiceBuilder = ReturnType<typeof dbServiceBuilder>;
