import {
  genericInternalError,
  TokenGenerationStatesGenericClient,
} from "pagopa-interop-models";
import {
  AttributeValue,
  DynamoDBClient,
  ScanCommand,
  ScanCommandOutput,
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
      const runPaginatedQuery = async (
        exclusiveStartKey?: Record<string, AttributeValue>
      ): Promise<PlatformStatesGenericEntry[]> => {
        const readInput: ScanInput = {
          TableName: config.tokenGenerationReadModelTableNamePlatform,
          ExclusiveStartKey: exclusiveStartKey,
          ConsistentRead: true,
        };
        const commandQuery = new ScanCommand(readInput);
        const data: ScanCommandOutput = await dynamoDBClient.send(commandQuery);

        if (!data.Items) {
          throw genericInternalError(
            `Unable to read platform-states entries: result ${JSON.stringify(
              data
            )} `
          );
        } else {
          const unmarshalledItems = data.Items.map((item) => unmarshall(item));

          const platformStateEntries = z
            .array(PlatformStatesGenericEntry)
            .safeParse(unmarshalledItems);

          if (!platformStateEntries.success) {
            throw genericInternalError(
              `Unable to parse platform-states entries: result ${JSON.stringify(
                platformStateEntries
              )} - data ${JSON.stringify(data)} `
            );
          }

          if (!data.LastEvaluatedKey) {
            return platformStateEntries.data;
          } else {
            return [
              ...platformStateEntries.data,
              ...(await runPaginatedQuery(data.LastEvaluatedKey)),
            ];
          }
        }
      };

      return await runPaginatedQuery();
    },

    async readAllTokenGenerationStatesItems(): Promise<
      TokenGenerationStatesGenericClient[]
    > {
      const runPaginatedQuery = async (
        exclusiveStartKey?: Record<string, AttributeValue>
      ): Promise<TokenGenerationStatesGenericClient[]> => {
        const readInput: ScanInput = {
          TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
          ExclusiveStartKey: exclusiveStartKey,
          ConsistentRead: true,
        };
        const commandQuery = new ScanCommand(readInput);
        const data: ScanCommandOutput = await dynamoDBClient.send(commandQuery);

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

          if (!data.LastEvaluatedKey) {
            return tokenGenStatesEntries.data;
          } else {
            return [
              ...tokenGenStatesEntries.data,
              ...(await runPaginatedQuery(data.LastEvaluatedKey)),
            ];
          }
        }
      };

      return await runPaginatedQuery();
    },
  };
}
