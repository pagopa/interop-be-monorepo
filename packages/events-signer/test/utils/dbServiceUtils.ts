import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  GetItemCommand,
  GetItemInput,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { z } from "zod";
import { genericInternalError } from "pagopa-interop-models";
import { config } from "../../src/config/config.js";

export const SignatureReferenceSchema = z.object({
  safeStorageId: z.string(),
  fileKind: z.string(),
  fileName: z.string(),
});

export type TestSignatureReference = z.infer<typeof SignatureReferenceSchema>;

export const readSignatureReference = async (
  safeStorageId: string,
  dynamoDBClient: DynamoDBClient
): Promise<TestSignatureReference | undefined> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: safeStorageId },
    },
    TableName: config.dbTableName,
    ConsistentRead: true,
  };

  const command = new GetItemCommand(input);

  try {
    const data = await dynamoDBClient.send(command);
    if (!data.Item) {
      return undefined;
    } else {
      const unmarshalled = unmarshall(data.Item);
      const parsedItem = SignatureReferenceSchema.safeParse(unmarshalled);
      if (!parsedItem.success) {
        throw genericInternalError(
          `Unable to parse signature reference with ID '${safeStorageId}': ` +
            `Validation errors: ${JSON.stringify(parsedItem.error.issues)} - ` +
            `Raw data: ${JSON.stringify(unmarshalled)}`
        );
      }
      return parsedItem.data;
    }
  } catch (error) {
    throw genericInternalError(
      `Error reading signature reference with ID '${safeStorageId}': ${error}`
    );
  }
};

export const buildDynamoDBTable = async (
  dynamoDBClient: DynamoDBClient,
  tableName: string
): Promise<void> => {
  try {
    const listTablesCommand = new ListTablesCommand({});
    const existingTables = await dynamoDBClient.send(listTablesCommand);

    if (existingTables.TableNames?.includes(tableName)) {
      await deleteDynamoDBTable(dynamoDBClient, tableName);
    }

    const createTableCommand = new CreateTableCommand({
      TableName: tableName,
      AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
    });
    await dynamoDBClient.send(createTableCommand);
  } catch (error) {
    throw genericInternalError(
      `Error building DynamoDB table ${tableName}: ${error}`
    );
  }
};

export const deleteDynamoDBTable = async (
  dynamoDBClient: DynamoDBClient,
  tableName: string
): Promise<void> => {
  try {
    const deleteTableCommand = new DeleteTableCommand({ TableName: tableName });
    await dynamoDBClient.send(deleteTableCommand);
  } catch (error) {
    throw genericInternalError(
      `Error deleting DynamoDB table ${tableName}: ${error}`
    );
  }
};
