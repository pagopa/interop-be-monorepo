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
    async readAllPlatformStatesItems(): Promise<PlatformStatesGenericEntry[]> {
      // eslint-disable-next-line functional/no-let
      let exclusiveStartKey: Record<string, AttributeValue> | undefined;
      const platformStatesResult = new Array<PlatformStatesGenericEntry>();

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
        } else {
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

          // eslint-disable-next-line functional/immutable-data
          platformStatesResult.push(...platformStatesEntries.data);

          exclusiveStartKey = data.LastEvaluatedKey;
        }
      } while (exclusiveStartKey);

      return platformStatesResult;
    },

    async readAllTokenGenerationStatesItems(): Promise<
      TokenGenerationStatesGenericClient[]
    > {
      // eslint-disable-next-line functional/no-let
      let exclusiveStartKey: Record<string, AttributeValue> | undefined;
      const tokenGenStatesResult =
        new Array<TokenGenerationStatesGenericClient>();

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
        } else {
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

          // eslint-disable-next-line functional/immutable-data
          tokenGenStatesResult.push(...tokenGenStatesEntries.data);

          exclusiveStartKey = data.LastEvaluatedKey;
        }
      } while (exclusiveStartKey);

      return tokenGenStatesResult;
    },
  };
}
