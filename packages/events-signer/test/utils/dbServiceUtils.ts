import {
  DynamoDBClient,
  GetItemCommand,
  GetItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { config } from "../../src/config/config.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const readSignatureReference = async (
  safeStorageId: string,
  dynamoDBClient: DynamoDBClient
) => {
  const input: GetItemInput = {
    Key: {
      PK: { S: safeStorageId },
    },
    TableName: config.signatureReferencesTableName,
    ConsistentRead: true,
  };

  const command = new GetItemCommand(input);

  try {
    const data = await dynamoDBClient.send(command);
    if (!data.Item) {
      return undefined;
    } else {
      return unmarshall(data.Item);
    }
  } catch (error) {
    throw genericInternalError(
      `Error reading signature reference with ID '${safeStorageId}': ${error}`
    );
  }
};
