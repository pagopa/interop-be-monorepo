/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  AttributeValue,
  DynamoDBClient,
  PutItemCommand,
  PutItemInput,
  QueryCommand,
  QueryCommandOutput,
  QueryInput,
  ScanCommand,
  ScanCommandOutput,
  ScanInput,
} from "@aws-sdk/client-dynamodb";
import {
  genericInternalError,
  GSIPKEServiceIdDescriptorId,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { z } from "zod";

export const writeTokenStateEntry = async (
  tokenStateEntry: TokenGenerationStatesClientPurposeEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: tokenStateEntry.PK,
      },
      descriptorState: {
        S: tokenStateEntry.descriptorState!,
      },
      descriptorAudience: {
        L: tokenStateEntry.descriptorAudience
          ? tokenStateEntry.descriptorAudience.map((item) => ({
              S: item,
            }))
          : [],
      },
      updatedAt: {
        S: tokenStateEntry.updatedAt,
      },
      consumerId: {
        S: tokenStateEntry.consumerId,
      },
      agreementId: {
        S: tokenStateEntry.agreementId!,
      },
      purposeVersionId: {
        S: tokenStateEntry.purposeVersionId!,
      },
      GSIPK_consumerId_eserviceId: {
        S: tokenStateEntry.GSIPK_consumerId_eserviceId!,
      },
      clientKind: {
        S: tokenStateEntry.clientKind,
      },
      publicKey: {
        S: tokenStateEntry.publicKey,
      },
      GSIPK_clientId: {
        S: tokenStateEntry.GSIPK_clientId,
      },
      GSIPK_kid: {
        S: tokenStateEntry.GSIPK_kid,
      },
      GSIPK_clientId_purposeId: {
        S: tokenStateEntry.GSIPK_clientId_purposeId!,
      },
      agreementState: {
        S: tokenStateEntry.agreementState!,
      },
      GSIPK_eserviceId_descriptorId: {
        S: tokenStateEntry.GSIPK_eserviceId_descriptorId!,
      },
      GSIPK_purposeId: {
        S: tokenStateEntry.GSIPK_purposeId!,
      },
      purposeState: {
        S: tokenStateEntry.purposeState!,
      },
    },
    TableName: "token-generation-states",
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const readAllTokenStateItems = async (
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
  const readInput: ScanInput = {
    TableName: "token-generation-states",
  };
  const commandQuery = new ScanCommand(readInput);
  const data: ScanCommandOutput = await dynamoDBClient.send(commandQuery);

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
    return tokenStateEntries.data;
  }
};

export const readTokenStateEntriesByEserviceIdAndDescriptorId = async (
  eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
  const runPaginatedQuery = async (
    eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
    const input: QueryInput = {
      TableName: "token-generation-states",
      IndexName: "Descriptor",
      KeyConditionExpression: `GSIPK_eserviceId_descriptorId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: eserviceId_descriptorId },
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
            eserviceId_descriptorId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(
    eserviceId_descriptorId,
    dynamoDBClient,
    undefined
  );
};
