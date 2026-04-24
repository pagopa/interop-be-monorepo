import {
  genericInternalError,
  TokenGenerationStatesGenericClient,
} from "pagopa-interop-models";
import {
  AttributeValue,
  DynamoDBClient,
  ScanCommand,
  ScanInput,
} from "@aws-sdk/client-dynamodb";
import { PlatformStatesGenericEntry } from "pagopa-interop-models";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { z } from "zod";
import { config } from "../configs/config.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tokenGenerationReadModelServiceBuilder(
  dynamoDBClient: DynamoDBClient
) {
  return {
    async *readPlatformStatesItemsPages(): AsyncGenerator<
      PlatformStatesGenericEntry[],
      void,
      void
    > {
      // eslint-disable-next-line functional/no-let
      let exclusiveStartKey: Record<string, AttributeValue> | undefined;

      do {
        const readInput: ScanInput = {
          TableName: config.tokenGenerationReadModelTableNamePlatform,
          ExclusiveStartKey: exclusiveStartKey,
          ConsistentRead: true,
        };
        const commandQuery = new ScanCommand(readInput);
        const data = await dynamoDBClient.send(commandQuery);

        if (!data.Items) {
          throw genericInternalError(
            `Unable to read platform-states entries: result ${JSON.stringify(
              data
            )} `
          );
        }

        const unmarshalledItems = data.Items.map((item) => unmarshall(item));

        const platformStatesEntries = z
          .array(PlatformStatesGenericEntry)
          .safeParse(unmarshalledItems);

        if (!platformStatesEntries.success) {
          throw genericInternalError(
            `Unable to parse platform-states entries: result ${JSON.stringify(
              platformStatesEntries
            )} - data ${JSON.stringify(data)} `
          );
        }

        yield platformStatesEntries.data;

        exclusiveStartKey = data.LastEvaluatedKey;
      } while (exclusiveStartKey);
    },

    async readAllPlatformStatesItems(): Promise<PlatformStatesGenericEntry[]> {
      const platformStatesResult = new Array<PlatformStatesGenericEntry>();

      for await (const page of this.readPlatformStatesItemsPages()) {
        // eslint-disable-next-line functional/immutable-data
        platformStatesResult.push(...page);
      }

      return platformStatesResult;
    },

    async *readTokenGenerationStatesItemsPages(): AsyncGenerator<
      TokenGenerationStatesGenericClient[],
      void,
      void
    > {
      // eslint-disable-next-line functional/no-let
      let exclusiveStartKey: Record<string, AttributeValue> | undefined;

      do {
        const readInput: ScanInput = {
          TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
          ExclusiveStartKey: exclusiveStartKey,
          ConsistentRead: true,
        };
        const commandQuery = new ScanCommand(readInput);
        const data = await dynamoDBClient.send(commandQuery);

        if (!data.Items) {
          throw genericInternalError(
            `Unable to read token-generation-states entries: result ${JSON.stringify(
              data
            )} `
          );
        }

        const unmarshalledItems = data.Items.map((item) => unmarshall(item));

        const tokenGenStatesEntries = z
          .array(TokenGenerationStatesGenericClient)
          .safeParse(unmarshalledItems);

        if (!tokenGenStatesEntries.success) {
          throw genericInternalError(
            `Unable to parse token-generation-states entries: result ${JSON.stringify(
              tokenGenStatesEntries
            )} - data ${JSON.stringify(data)} `
          );
        }

        yield tokenGenStatesEntries.data;

        exclusiveStartKey = data.LastEvaluatedKey;
      } while (exclusiveStartKey);
    },

    async readAllTokenGenerationStatesItems(): Promise<
      TokenGenerationStatesGenericClient[]
    > {
      const tokenGenStatesResult =
        new Array<TokenGenerationStatesGenericClient>();

      for await (const page of this.readTokenGenerationStatesItemsPages()) {
        // eslint-disable-next-line functional/immutable-data
        tokenGenStatesResult.push(...page);
      }

      return tokenGenStatesResult;
    },
  };
}
