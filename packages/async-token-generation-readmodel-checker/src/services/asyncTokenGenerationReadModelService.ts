import {
  AttributeValue,
  DynamoDBClient,
  ScanCommand,
  ScanInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  genericInternalError,
  PlatformStatesGenericEntry,
  ProducerKeychainPlatformStateEntry,
  TokenGenerationStatesGenericClient,
} from "pagopa-interop-models";
import { z } from "zod";
import { config } from "../configs/config.js";

async function* scanPages<T>({
  dynamoDBClient,
  tableName,
  label,
  schema,
}: {
  dynamoDBClient: DynamoDBClient;
  tableName: string;
  label: string;
  schema: z.ZodType<T[], z.ZodTypeDef, unknown>;
}): AsyncGenerator<T[], void, void> {
  // eslint-disable-next-line functional/no-let
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const input: ScanInput = {
      TableName: tableName,
      ExclusiveStartKey: exclusiveStartKey,
      ConsistentRead: true,
    };
    const data = await dynamoDBClient.send(new ScanCommand(input));

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read ${label} entries: result ${JSON.stringify(data)}`
      );
    }

    const unmarshalledItems = data.Items.map((item) => unmarshall(item));
    const parsedItems = schema.safeParse(unmarshalledItems);

    if (!parsedItems.success) {
      throw genericInternalError(
        `Unable to parse ${label} entries: result ${JSON.stringify(
          parsedItems
        )} - data ${JSON.stringify(data)}`
      );
    }

    yield parsedItems.data as T[];

    exclusiveStartKey = data.LastEvaluatedKey;
  } while (exclusiveStartKey);
}

async function* scanRawPages({
  dynamoDBClient,
  tableName,
  label,
}: {
  dynamoDBClient: DynamoDBClient;
  tableName: string;
  label: string;
}): AsyncGenerator<unknown[], void, void> {
  // eslint-disable-next-line functional/no-let
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const input: ScanInput = {
      TableName: tableName,
      ExclusiveStartKey: exclusiveStartKey,
      ConsistentRead: true,
    };
    const data = await dynamoDBClient.send(new ScanCommand(input));

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read ${label} entries: result ${JSON.stringify(data)}`
      );
    }

    yield data.Items.map((item) => unmarshall(item));

    exclusiveStartKey = data.LastEvaluatedKey;
  } while (exclusiveStartKey);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function asyncTokenGenerationReadModelServiceBuilder(
  dynamoDBClient: DynamoDBClient
) {
  return {
    readPlatformStatesItemsPages: (): AsyncGenerator<
      PlatformStatesGenericEntry[],
      void,
      void
    > =>
      scanPages({
        dynamoDBClient,
        tableName: config.platformStatesTable,
        label: "platform-states",
        schema: z.array(PlatformStatesGenericEntry),
      }),

    readTokenGenerationStatesItemsPages: (): AsyncGenerator<
      TokenGenerationStatesGenericClient[],
      void,
      void
    > =>
      scanPages({
        dynamoDBClient,
        tableName: config.tokenGenerationStatesTable,
        label: "token-generation-states",
        schema: z.array(TokenGenerationStatesGenericClient),
      }),

    readProducerKeychainPlatformStatesItemsPages: (): AsyncGenerator<
      ProducerKeychainPlatformStateEntry[],
      void,
      void
    > =>
      scanPages({
        dynamoDBClient,
        tableName: config.producerKeychainPlatformStatesTable,
        label: "producer-keychain-platform-states",
        schema: z.array(ProducerKeychainPlatformStateEntry),
      }),

    readInteractionsItemsPages: (): AsyncGenerator<unknown[], void, void> =>
      scanRawPages({
        dynamoDBClient,
        tableName: config.interactionsTable,
        label: "interactions",
      }),
  };
}

export type AsyncTokenGenerationReadModelService = ReturnType<
  typeof asyncTokenGenerationReadModelServiceBuilder
>;
