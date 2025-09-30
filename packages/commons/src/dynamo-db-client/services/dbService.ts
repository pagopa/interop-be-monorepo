import {
  DynamoDBClient,
  PutItemCommand,
  PutItemInput,
  DeleteItemCommand,
  GetItemInput,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { getUnixTime } from "date-fns";
import { DynamoDBClientConfig } from "../config/config.js";
import { formatError } from "../utils/errorFormatter.js";
import { SignatureReference } from "../models/signatureReference.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function dbServiceBuilder(
  dynamoDBClient: DynamoDBClient,
  config: DynamoDBClientConfig
) {
  return {
    saveSignatureReference: async (
      reference: SignatureReference
    ): Promise<void> => {
      const input: PutItemInput = {
        TableName: config.signatureReferencesTableName,
        Item: {
          safeStorageId: { S: reference.safeStorageId },
          correlationId: { S: reference.correlationId },
          fileKind: { S: reference.fileKind },
          fileName: { S: reference.fileName },
          creationTimestamp: { N: getUnixTime(new Date()).toString() },
        },
        ReturnValues: "NONE",
      };

      try {
        await dynamoDBClient.send(new PutItemCommand(input));
      } catch (error) {
        throw genericInternalError(
          `Error saving record on table '${
            config.signatureReferencesTableName
          }' id='${reference.safeStorageId}': ${formatError(error)}`
        );
      }
    },

    readSignatureReference: async (
      id: string
    ): Promise<SignatureReference | undefined> => {
      const input: GetItemInput = {
        Key: {
          safeStorageId: { S: id },
        },
        TableName: config.signatureReferencesTableName,
        ConsistentRead: true,
      };

      const command = new GetItemCommand(input);

      try {
        const data = await dynamoDBClient.send(command);

        if (!data.Item) {
          return undefined;
        }
        if (
          !data.Item.safeStorageId?.S ||
          !data.Item.correlationId?.S ||
          !data.Item.fileKind?.S ||
          !data.Item.fileName?.S ||
          !data.Item.creationTimestamp?.N
        ) {
          throw genericInternalError(
            `Malformed item in table '${config.signatureReferencesTableName}' for id='${id}'`
          );
        }

        const reference: SignatureReference = {
          safeStorageId: data.Item.safeStorageId.S,
          correlationId: data.Item.correlationId.S,
          fileKind: data.Item.fileKind.S,
          fileName: data.Item.fileName.S,
        };

        return reference;
      } catch (error) {
        throw genericInternalError(
          `Error reading signature reference with id='${id}' from table '${
            config.signatureReferencesTableName
          }': ${formatError(error)}`
        );
      }
    },

    deleteFromDynamo: async (id: string): Promise<void> => {
      const command = new DeleteItemCommand({
        TableName: config.signatureReferencesTableName,
        Key: {
          safeStorageId: { S: id },
        },
      });

      try {
        await dynamoDBClient.send(command);
      } catch (error) {
        throw genericInternalError(
          `Error deleting record with id='${id}' from table '${
            config.signatureReferencesTableName
          }': ${formatError(error)}`
        );
      }
    },
  };
}

export type DbServiceBuilder = ReturnType<typeof dbServiceBuilder>;
