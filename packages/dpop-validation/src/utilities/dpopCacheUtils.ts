import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { DPoPCache } from "pagopa-interop-models";

export const writeDPoPCache = async ({
  dynamoDBClient,
  dpopCacheTable,
  jti,
  iat,
  durationSeconds,
}: {
  dynamoDBClient: DynamoDBClient;
  dpopCacheTable: string;
  jti: string;
  iat: number;
  durationSeconds: number;
}): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(jti)",
    Item: {
      jti: {
        S: jti,
      },
      iat: {
        N: iat.toString(),
      },
      ttl: {
        N: (iat + durationSeconds).toString(),
      },
    },
    TableName: dpopCacheTable,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const readDPoPCache = async (
  dynamoDBClient: DynamoDBClient,
  jti: string,
  dpopCacheTable: string
): Promise<DPoPCache | undefined> => {
  const input: GetItemInput = {
    Key: {
      jti: { S: jti },
    },
    TableName: dpopCacheTable,
    ConsistentRead: true,
  };
  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Item);
    const dpopCache = DPoPCache.safeParse(unmarshalled);

    if (!dpopCache.success) {
      throw genericInternalError(
        `Unable to parse DPoP cache entry: result ${JSON.stringify(
          dpopCache
        )} - data ${JSON.stringify(data)} `
      );
    }
    return dpopCache.data;
  }
};
