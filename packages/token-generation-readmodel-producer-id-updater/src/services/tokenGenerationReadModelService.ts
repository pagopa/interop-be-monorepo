import {
  genericInternalError,
  PlatformStatesAgreementEntry,
  TenantId,
  TokenGenerationStatesConsumerClient,
} from "pagopa-interop-models";
import {
  AttributeValue,
  DynamoDBClient,
  ScanCommand,
  ScanCommandOutput,
  ScanInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { z } from "zod";
import { config } from "../configs/config.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tokenGenerationReadModelServiceBuilder(
  dynamoDBClient: DynamoDBClient
) {
  return {
    async readAllPlatformStatesAgreements(): Promise<
      Array<
        Omit<PlatformStatesAgreementEntry, "producerId"> & {
          producerId?: TenantId;
        }
      >
    > {
      const runPaginatedQuery = async (
        exclusiveStartKey?: Record<string, AttributeValue>
      ): Promise<
        Array<
          Omit<PlatformStatesAgreementEntry, "producerId"> & {
            producerId?: TenantId;
          }
        >
      > => {
        const readInput: ScanInput = {
          TableName: config.tokenGenerationReadModelTableNamePlatform,
          ExclusiveStartKey: exclusiveStartKey,
          ConsistentRead: true,
          FilterExpression: "attribute_exists(agreementId)",
        };
        const commandQuery = new ScanCommand(readInput);
        const data: ScanCommandOutput = await dynamoDBClient.send(commandQuery);

        if (!data.Items) {
          throw genericInternalError(
            `Unable to read platform-states agreements: result ${JSON.stringify(
              data
            )} `
          );
        } else {
          const unmarshalledItems = data.Items.map((item) => unmarshall(item));

          const platformStatesAgreements = z
            .array(
              PlatformStatesAgreementEntry.extend({
                producerId: TenantId.optional(),
              })
            )
            .safeParse(unmarshalledItems);

          if (!platformStatesAgreements.success) {
            throw genericInternalError(
              `Unable to parse platform-states agreements: result ${JSON.stringify(
                platformStatesAgreements
              )} - data ${JSON.stringify(data)} `
            );
          }

          if (!data.LastEvaluatedKey) {
            return platformStatesAgreements.data;
          } else {
            return [
              ...platformStatesAgreements.data,
              ...(await runPaginatedQuery(data.LastEvaluatedKey)),
            ];
          }
        }
      };

      return await runPaginatedQuery();
    },

    async readAllTokenGenStatesConsumerClients(): Promise<
      TokenGenerationStatesConsumerClient[]
    > {
      const runPaginatedQuery = async (
        exclusiveStartKey?: Record<string, AttributeValue>
      ): Promise<TokenGenerationStatesConsumerClient[]> => {
        const readInput: ScanInput = {
          TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
          ExclusiveStartKey: exclusiveStartKey,
          ConsistentRead: true,
          FilterExpression: "attribute_exists(agreementId)",
        };
        const commandQuery = new ScanCommand(readInput);
        const data: ScanCommandOutput = await dynamoDBClient.send(commandQuery);

        if (!data.Items) {
          throw genericInternalError(
            `Unable to read token-generation-states consumer clients: result ${JSON.stringify(
              data
            )} `
          );
        } else {
          const unmarshalledItems = data.Items.map((item) => unmarshall(item));

          const tokenGenStatesEntries = z
            .array(TokenGenerationStatesConsumerClient)
            .safeParse(unmarshalledItems);

          if (!tokenGenStatesEntries.success) {
            throw genericInternalError(
              `Unable to parse token-generation-states consumer clients: result ${JSON.stringify(
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
