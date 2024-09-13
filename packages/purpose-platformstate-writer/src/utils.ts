import {
  AttributeValue,
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
  QueryCommand,
  QueryCommandOutput,
  QueryInput,
  UpdateItemCommand,
  UpdateItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  genericInternalError,
  itemState,
  ItemState,
  PlatformStatesPurposeEntry,
  PlatformStatesPurposePK,
  Purpose,
  PurposeId,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import { z } from "zod";
import { config } from "./config/config.js";

export const purposeStateToItemState = (purpose: Purpose): ItemState =>
  !purpose.suspendedByConsumer && !purpose.suspendedByProducer
    ? itemState.active
    : itemState.inactive;

export const writePlatformPurposeEntry = async (
  purposeEntry: PlatformStatesPurposeEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: purposeEntry.PK,
      },
      state: {
        S: purposeEntry.state,
      },
      purposeVersionId: {
        S: purposeEntry.purposeVersionId,
      },
      purposeEserviceId: {
        S: purposeEntry.purposeEserviceId,
      },
      purposeConsumerId: {
        S: purposeEntry.purposeConsumerId,
      },
      version: {
        N: purposeEntry.version.toString(),
      },
      updatedAt: {
        S: purposeEntry.updatedAt,
      },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const readPlatformPurposeEntry = async (
  primaryKey: PlatformStatesPurposePK,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesPurposeEntry | undefined> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Item);
    const purposeEntry = PlatformStatesPurposeEntry.safeParse(unmarshalled);

    if (!purposeEntry.success) {
      throw genericInternalError(
        `Unable to parse purpose entry item: result ${JSON.stringify(
          purposeEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return purposeEntry.data;
  }
};

export const readTokenEntriesByPurposeId = async (
  purposeId: PurposeId,
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
  const runPaginatedQuery = async (
    purposeId: PurposeId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "GSIPK_purposeId",
      KeyConditionExpression: `GSIPK_purposeId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: purposeId },
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

      if (!data.LastEvaluatedKey) {
        return tokenStateEntries.data;
      } else {
        return [
          ...tokenStateEntries.data,
          ...(await runPaginatedQuery(
            purposeId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(purposeId, dynamoDBClient, undefined);
};

export const updatePurposeStateInPlatformStatesEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesPurposePK,
  state: ItemState,
  version: number
): Promise<void> => {
  const input: UpdateItemInput = {
    ConditionExpression: "attribute_exists(PK)",
    Key: {
      PK: {
        S: primaryKey,
      },
    },
    ExpressionAttributeValues: {
      ":newState": {
        S: state,
      },
      ":newVersion": {
        N: version.toString(),
      },
      ":newUpdateAt": {
        S: new Date().toISOString(),
      },
    },
    ExpressionAttributeNames: {
      "#state": "state",
    },
    UpdateExpression:
      "SET #state = :newState, version = :newVersion, updatedAt = :newUpdateAt",
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
};

export const updatePurposeStateInTokenGenerationStatesTable = async (
  purpose: Purpose,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const purposeState = purposeStateToItemState(purpose);
  const entriesToUpdate = await readTokenEntriesByPurposeId(
    purpose.id,
    dynamoDBClient
  );

  for (const entry of entriesToUpdate) {
    const input: UpdateItemInput = {
      ConditionExpression: "attribute_exists(GSIPK_purposeId)",
      Key: {
        PK: {
          S: entry.PK,
        },
      },
      ExpressionAttributeValues: {
        ":newState": {
          S: purposeState,
        },
        ":newUpdateAt": {
          S: new Date().toISOString(),
        },
      },
      UpdateExpression:
        "SET purposeState = :newState, updatedAt = :newUpdateAt",
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "NONE",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
  }
};
