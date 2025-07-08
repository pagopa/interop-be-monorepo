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
      // eslint-disable-next-line functional/no-let
      let exclusiveStartKey: Record<string, AttributeValue> | undefined;
      const platformStatesAgreementsResult = new Array<
        Omit<PlatformStatesAgreementEntry, "producerId"> & {
          producerId?: TenantId;
        }
      >();

      do {
        const readInput: ScanInput = {
          TableName: config.tokenGenerationReadModelTableNamePlatform,
          ExclusiveStartKey: exclusiveStartKey,
          ConsistentRead: true,
          FilterExpression: "attribute_exists(agreementId)",
        };
        const commandQuery = new ScanCommand(readInput);
        const data = await dynamoDBClient.send(commandQuery);

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

          // eslint-disable-next-line functional/immutable-data
          platformStatesAgreementsResult.push(...platformStatesAgreements.data);

          exclusiveStartKey = data.LastEvaluatedKey;
        }
      } while (exclusiveStartKey);

      return platformStatesAgreementsResult;
    },

    async readAllTokenGenStatesConsumerClients(): Promise<
      TokenGenerationStatesConsumerClient[]
    > {
      // eslint-disable-next-line functional/no-let
      let exclusiveStartKey: Record<string, AttributeValue> | undefined;
      const tokenGenStatesConsumerClients =
        new Array<TokenGenerationStatesConsumerClient>();

      do {
        const readInput: ScanInput = {
          TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
          ExclusiveStartKey: exclusiveStartKey,
          ConsistentRead: true,
          FilterExpression: "attribute_exists(agreementId)",
        };
        const commandQuery = new ScanCommand(readInput);
        const data = await dynamoDBClient.send(commandQuery);

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

          // eslint-disable-next-line functional/immutable-data
          tokenGenStatesConsumerClients.push(...tokenGenStatesEntries.data);

          exclusiveStartKey = data.LastEvaluatedKey;
        }
      } while (exclusiveStartKey);

      return tokenGenStatesConsumerClients;
    },
  };
}
