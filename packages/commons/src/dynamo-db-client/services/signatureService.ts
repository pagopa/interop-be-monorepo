import {
  DynamoDBClient,
  PutItemCommand,
  PutItemInput,
  GetItemInput,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { getUnixTime } from "date-fns";
import { DynamoDBClientConfig } from "../config/config.js";
import { formatError } from "../utils/errorFormatter.js";
import { SignatureReference } from "../models/signatureReference.js";
import { assertValidSignatureReferenceItem } from "../utils/assertSignatureIsValid.js";
import { DocumentSignatureReference } from "../models/documentSignatureReference.js";
import { assertValidDocumentSignatureReferenceItem } from "../utils/assertDocumentSignatureIsValid.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function signatureServiceBuilder(
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

    saveDocumentSignatureReference: async (
      reference: DocumentSignatureReference
    ): Promise<void> => {
      const item: DocumentSignatureReference = reference;
      const input: PutItemInput = {
        TableName: config.signatureReferencesTableName,
        Item: {
          safeStorageId: { S: item.safeStorageId },
          fileKind: { S: item.fileKind },
          streamId: { S: item.streamId },
          subObjectId: { S: item.subObjectId },
          contentType: { S: item.contentType },
          path: { S: item.path },
          prettyname: { S: item.prettyname },
          fileName: { S: item.fileName },
          version: { N: String(item.version) },
          createdAt: { N: String(item.createdAt) },
          correlationId: { S: item.correlationId },
        },
        ReturnValues: "NONE",
      };

      const command = new PutItemCommand(input);

      try {
        await dynamoDBClient.send(command);
      } catch (error) {
        throw genericInternalError(
          `Error saving document signature with id: '${
            item.safeStorageId
          }' on table '${config.signatureReferencesTableName}': ${formatError(
            error
          )}`
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

        assertValidSignatureReferenceItem(
          data.Item,
          config.signatureReferencesTableName,
          id
        );

        const reference: SignatureReference = {
          safeStorageId: data.Item.safeStorageId.S,
          correlationId: data.Item.correlationId.S,
          fileKind: data.Item.fileKind.S,
          fileName: data.Item.fileName.S,
          creationTimestamp: Number(data.Item.creationTimestamp.N),
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

    deleteSignatureReference: async (id: string): Promise<void> => {
      const FIFTEEN_DAYS = 15 * 24 * 60 * 60;

      const command = new UpdateItemCommand({
        TableName: config.signatureReferencesTableName,
        Key: {
          safeStorageId: { S: id },
        },
        UpdateExpression: "SET #ttl = :ttl, logicallyDeleted = :deleted",
        ExpressionAttributeNames: {
          "#ttl": "ttl",
        },
        ExpressionAttributeValues: {
          ":ttl": { N: (getUnixTime(new Date()) + FIFTEEN_DAYS).toString() },
          ":deleted": { BOOL: true },
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

    readDocumentSignatureReference: async (
      id: string
    ): Promise<DocumentSignatureReference | undefined> => {
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

        assertValidDocumentSignatureReferenceItem(
          data.Item,
          config.signatureReferencesTableName,
          id
        );

        const reference: DocumentSignatureReference = {
          safeStorageId: data.Item.safeStorageId.S,
          fileKind: data.Item.fileKind.S,
          streamId: data.Item.streamId.S,
          subObjectId: data.Item.subObjectId.S,
          contentType: data.Item.contentType.S,
          path: data.Item.contentType.S,
          prettyname: data.Item.prettyname.S,
          fileName: data.Item.fileName.S,
          version: Number(data.Item.version.N),
          createdAt: BigInt(data.Item.createdAt.N),
          correlationId: data.Item.correlationId.S,
          creationTimestamp: Number(data.Item.creationTimestamp.N),
        };

        return reference;
      } catch (error) {
        throw genericInternalError(
          `Error reading document signature reference with id='${id}' from table '${
            config.signatureReferencesTableName
          }': ${formatError(error)}`
        );
      }
    },
  };
}

export type SignatureServiceBuilder = ReturnType<
  typeof signatureServiceBuilder
>;
