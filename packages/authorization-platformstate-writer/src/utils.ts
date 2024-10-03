import {
  AttributeValue,
  DeleteItemCommand,
  DeleteItemInput,
  DynamoDBClient,
  QueryCommand,
  QueryCommandOutput,
  QueryInput,
} from "@aws-sdk/client-dynamodb";
import {
  genericInternalError,
  GSIPKClientId,
  GSIPKKid,
  PlatformStatesClientPK,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import { z } from "zod";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { config } from "./config/config.js";

export const deleteEntriesFromTokenStatesByKid = async (
  GSIPK_kid: GSIPKKid,
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesClientEntry[]> => {
  const runPaginatedQuery = async (
    GSIPK_kid: GSIPKKid,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenerationStatesClientEntry[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Key",
      KeyConditionExpression: `GSIPK_kid = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: GSIPK_kid },
      },
      ExclusiveStartKey: exclusiveStartKey,
    };
    const command = new QueryCommand(input);
    const data: QueryCommandOutput = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token state entries: result ${JSON.stringify(data)} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const tokenStateEntries = z
        .array(TokenGenerationStatesClientPurposeEntry)
        .safeParse(unmarshalledItems);

      if (!tokenStateEntries.success) {
        throw genericInternalError(
          `Unable to parse token state entry item: result ${JSON.stringify(
            tokenStateEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      await deleteClientEntriesFromTokenGenerationStatesTable(
        tokenStateEntries.data,
        dynamoDBClient
      );

      if (!data.LastEvaluatedKey) {
        return tokenStateEntries.data;
      } else {
        return [
          ...tokenStateEntries.data,
          ...(await runPaginatedQuery(
            GSIPK_kid,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(GSIPK_kid, dynamoDBClient, undefined);
};

export const deleteClientEntryFromPlatformStates = async (
  pk: PlatformStatesClientPK,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: DeleteItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new DeleteItemCommand(input);
  await dynamoDBClient.send(command);
};

export const deleteEntriesFromTokenStatesByClient = async (
  GSIPK_client: GSIPKClientId,
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesClientEntry[]> => {
  const runPaginatedQuery = async (
    GSIPK_client: GSIPKClientId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenerationStatesClientEntry[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Client",
      KeyConditionExpression: `GSIPK_client = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: GSIPK_client },
      },
      ExclusiveStartKey: exclusiveStartKey,
    };
    const command = new QueryCommand(input);
    const data: QueryCommandOutput = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token state entries: result ${JSON.stringify(data)} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const tokenStateEntries = z
        .array(TokenGenerationStatesClientPurposeEntry)
        .safeParse(unmarshalledItems);

      if (!tokenStateEntries.success) {
        throw genericInternalError(
          `Unable to parse token state entry item: result ${JSON.stringify(
            tokenStateEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      await deleteClientEntriesFromTokenGenerationStatesTable(
        tokenStateEntries.data,
        dynamoDBClient
      );

      if (!data.LastEvaluatedKey) {
        return tokenStateEntries.data;
      } else {
        return [
          ...tokenStateEntries.data,
          ...(await runPaginatedQuery(
            GSIPK_client,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(GSIPK_client, dynamoDBClient, undefined);
};

export const deleteClientEntriesFromTokenGenerationStatesTable = async (
  entriesToDelete: TokenGenerationStatesClientPurposeEntry[],
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  for (const entry of entriesToDelete) {
    const input: DeleteItemInput = {
      Key: {
        PK: { S: entry.PK },
      },
      TableName: config.tokenGenerationReadModelTableNamePlatform,
    };
    const command = new DeleteItemCommand(input);
    await dynamoDBClient.send(command);
  }
};

export const updatePurposeIdsInPlatformStateClientEntry = () => {};
