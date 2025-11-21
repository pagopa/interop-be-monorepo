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
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBClientConfig } from "../config/config.js";
import { formatError } from "../utils/errorFormatter.js";
import {
  SignatureReference,
  SignatureReferenceSchema,
} from "../models/signatureReference.js";
import {
  DocumentSignatureReference,
  DocumentSignatureReferenceSchema,
} from "../models/documentSignatureReference.js";

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
      const input: PutItemInput = {
        TableName: config.signatureReferencesTableName,
        Item: {
          safeStorageId: { S: reference.safeStorageId },
          fileKind: { S: reference.fileKind },
          streamId: { S: reference.streamId },
          subObjectId: { S: reference.subObjectId },
          contentType: { S: reference.contentType },
          path: { S: reference.path },
          prettyname: { S: reference.prettyname },
          fileName: { S: reference.fileName },
          version: { N: reference.version.toString() },
          createdAt: { N: reference.createdAt.toString() },
          correlationId: { S: reference.correlationId },
          creationTimestamp: { N: getUnixTime(new Date()).toString() },
        },
      };

      try {
        await dynamoDBClient.send(new PutItemCommand(input));
      } catch (error) {
        throw genericInternalError(
          `Error saving document signature with id='${
            reference.safeStorageId
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
        TableName: config.signatureReferencesTableName,
        Key: { safeStorageId: { S: id } },
        ConsistentRead: true,
      };

      try {
        const data = await dynamoDBClient.send(new GetItemCommand(input));
        if (!data.Item) {
          return undefined;
        }

        const normalized = unmarshall(data.Item);
        const parsed = SignatureReferenceSchema.safeParse(normalized);
        if (!parsed.success) {
          throw new Error(
            `Malformed item in table '${config.signatureReferencesTableName}' for id='${id}'`
          );
        }
        return parsed.data;
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
      const ttl = getUnixTime(new Date()) + FIFTEEN_DAYS;

      const command = new UpdateItemCommand({
        TableName: config.signatureReferencesTableName,
        Key: { safeStorageId: { S: id } },
        UpdateExpression: "SET #ttl = :ttl, logicallyDeleted = :deleted",
        ExpressionAttributeNames: { "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":ttl": { N: ttl.toString() },
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
        TableName: config.signatureReferencesTableName,
        Key: { safeStorageId: { S: id } },
        ConsistentRead: true,
      };

      try {
        const data = await dynamoDBClient.send(new GetItemCommand(input));
        if (!data.Item) {
          return undefined;
        }

        const normalized = unmarshall(data.Item);
        const parsed = DocumentSignatureReferenceSchema.safeParse(normalized);
        if (!parsed.success) {
          throw new Error(
            `Malformed item in table '${config.signatureReferencesTableName}' for id='${id}'`
          );
        }
        return parsed.data;
      } catch (error) {
        throw genericInternalError(
          `Error reading document signature reference with id='${id}' from table '${
            config.signatureReferencesTableName
          }': ${formatError(error)}`
        );
      }
    },

    readSignatureReferenceById: async (
      id: string
    ): Promise<SignatureReference | DocumentSignatureReference | undefined> => {
      const input: GetItemInput = {
        TableName: config.signatureReferencesTableName,
        Key: { safeStorageId: { S: id } },
        ConsistentRead: true,
      };

      try {
        const data = await dynamoDBClient.send(new GetItemCommand(input));
        if (!data.Item) {
          return undefined;
        }

        const normalized = unmarshall(data.Item);

        const docParse = DocumentSignatureReferenceSchema.safeParse(normalized);
        if (docParse.success) {
          return docParse.data;
        }

        const sigParse = SignatureReferenceSchema.safeParse(normalized);
        if (sigParse.success) {
          return sigParse.data;
        }

        throw new Error(
          `Unable to parse signature reference for id='${id}': ${JSON.stringify(
            normalized
          )}`
        );
      } catch (error) {
        throw genericInternalError(
          `Error reading signature reference with id='${id}' from table '${
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
