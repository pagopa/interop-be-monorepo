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
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  genericInternalError,
  GSIPKConsumerIdEServiceId,
  GSIPKEServiceIdDescriptorId,
  PlatformStatesCatalogEntry,
  PlatformStatesGenericEntry,
  TokenGenerationStatesConsumerClient,
  PlatformStatesPurposeEntry,
  PlatformStatesAgreementEntry,
  TokenGenerationStatesGenericClient,
  TokenGenerationStatesApiClient,
  TokenGenStatesConsumerClientGSIAgreement,
  TokenGenStatesConsumerClientGSIDescriptor,
  PlatformStatesClientEntry,
} from "pagopa-interop-models";
import { z } from "zod";

export const writeTokenGenStatesApiClient = async (
  tokenGenStatesEntry: TokenGenerationStatesApiClient,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: tokenGenStatesEntry.PK,
      },
      updatedAt: {
        S: tokenGenStatesEntry.updatedAt,
      },
      consumerId: {
        S: tokenGenStatesEntry.consumerId,
      },
      clientKind: {
        S: tokenGenStatesEntry.clientKind,
      },
      publicKey: {
        S: tokenGenStatesEntry.publicKey,
      },
      GSIPK_clientId: {
        S: tokenGenStatesEntry.GSIPK_clientId,
      },
      GSIPK_clientId_kid: {
        S: tokenGenStatesEntry.GSIPK_clientId_kid,
      },
    },
    TableName: "token-generation-states",
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const writeTokenGenStatesConsumerClient = async (
  tokenGenStatesEntry: TokenGenerationStatesConsumerClient,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: tokenGenStatesEntry.PK,
      },
      ...(tokenGenStatesEntry.descriptorState
        ? {
            descriptorState: {
              S: tokenGenStatesEntry.descriptorState,
            },
          }
        : {}),
      ...(tokenGenStatesEntry.descriptorAudience
        ? {
            descriptorAudience: {
              L: tokenGenStatesEntry.descriptorAudience.map((item) => ({
                S: item,
              })),
            },
          }
        : {}),
      ...(tokenGenStatesEntry.descriptorVoucherLifespan
        ? {
            descriptorVoucherLifespan: {
              N: tokenGenStatesEntry.descriptorVoucherLifespan.toString(),
            },
          }
        : {}),
      updatedAt: {
        S: tokenGenStatesEntry.updatedAt,
      },
      ...(tokenGenStatesEntry.consumerId
        ? {
            consumerId: {
              S: tokenGenStatesEntry.consumerId,
            },
          }
        : {}),
      ...(tokenGenStatesEntry.agreementId
        ? {
            agreementId: {
              S: tokenGenStatesEntry.agreementId,
            },
          }
        : {}),
      ...(tokenGenStatesEntry.purposeVersionId
        ? {
            purposeVersionId: {
              S: tokenGenStatesEntry.purposeVersionId,
            },
          }
        : {}),
      ...(tokenGenStatesEntry.GSIPK_consumerId_eserviceId
        ? {
            GSIPK_consumerId_eserviceId: {
              S: tokenGenStatesEntry.GSIPK_consumerId_eserviceId,
            },
          }
        : {}),
      clientKind: {
        S: tokenGenStatesEntry.clientKind,
      },
      publicKey: {
        S: tokenGenStatesEntry.publicKey,
      },
      GSIPK_clientId: {
        S: tokenGenStatesEntry.GSIPK_clientId,
      },
      GSIPK_clientId_kid: {
        S: tokenGenStatesEntry.GSIPK_clientId_kid,
      },
      ...(tokenGenStatesEntry.GSIPK_clientId_purposeId
        ? {
            GSIPK_clientId_purposeId: {
              S: tokenGenStatesEntry.GSIPK_clientId_purposeId,
            },
          }
        : {}),
      ...(tokenGenStatesEntry.agreementState
        ? {
            agreementState: {
              S: tokenGenStatesEntry.agreementState,
            },
          }
        : {}),
      ...(tokenGenStatesEntry.GSIPK_eserviceId_descriptorId
        ? {
            GSIPK_eserviceId_descriptorId: {
              S: tokenGenStatesEntry.GSIPK_eserviceId_descriptorId,
            },
          }
        : {}),
      ...(tokenGenStatesEntry.GSIPK_purposeId
        ? {
            GSIPK_purposeId: {
              S: tokenGenStatesEntry.GSIPK_purposeId,
            },
          }
        : {}),
      ...(tokenGenStatesEntry.purposeState
        ? {
            purposeState: {
              S: tokenGenStatesEntry.purposeState,
            },
          }
        : {}),
    },
    TableName: "token-generation-states",
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const readAllTokenGenStatesItems = async (
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesGenericClient[]> => {
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
    return tokenGenStatesEntries.data;
  }
};

export const readAllPlatformStatesItems = async (
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesGenericEntry[]> => {
  const readInput: ScanInput = {
    TableName: "platform-states",
  };
  const commandQuery = new ScanCommand(readInput);
  const data: ScanCommandOutput = await dynamoDBClient.send(commandQuery);

  if (!data.Items) {
    throw genericInternalError(
      `Unable to read platform state entries: result ${JSON.stringify(data)} `
    );
  } else {
    const unmarshalledItems = data.Items.map((item) => unmarshall(item));

    const platformStateEntries = z
      .array(PlatformStatesGenericEntry)
      .safeParse(unmarshalledItems);

    if (!platformStateEntries.success) {
      throw genericInternalError(
        `Unable to parse platform state entry item: result ${JSON.stringify(
          platformStateEntries
        )} - data ${JSON.stringify(data)} `
      );
    }
    return platformStateEntries.data;
  }
};

export const readTokenGenStatesEntriesByGSIPKEServiceIdDescriptorId = async (
  gsiPKEServiceIdDescriptorId: GSIPKEServiceIdDescriptorId,
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenStatesConsumerClientGSIDescriptor[]> => {
  const runPaginatedQuery = async (
    gsiPKEServiceIdDescriptorId: GSIPKEServiceIdDescriptorId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenStatesConsumerClientGSIDescriptor[]> => {
    const input: QueryInput = {
      TableName: "token-generation-states",
      IndexName: "Descriptor",
      KeyConditionExpression: `GSIPK_eserviceId_descriptorId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: gsiPKEServiceIdDescriptorId },
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

      const tokenGenStatesEntries = z
        .array(TokenGenStatesConsumerClientGSIDescriptor)
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
          ...(await runPaginatedQuery(
            gsiPKEServiceIdDescriptorId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(
    gsiPKEServiceIdDescriptorId,
    dynamoDBClient,
    undefined
  );
};

export const readTokenGenStatesEntriesByGSIPKConsumerIdEServiceId = async (
  gsiPKConsumerIdEServiceId: GSIPKConsumerIdEServiceId,
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenStatesConsumerClientGSIAgreement[]> => {
  const runPaginatedQuery = async (
    gsiPKConsumerIdEServiceId: GSIPKConsumerIdEServiceId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenStatesConsumerClientGSIAgreement[]> => {
    const input: QueryInput = {
      TableName: "token-generation-states",
      IndexName: "Agreement",
      KeyConditionExpression: `GSIPK_consumerId_eserviceId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: gsiPKConsumerIdEServiceId },
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

      const tokenGenStatesEntries = z
        .array(TokenGenStatesConsumerClientGSIAgreement)
        .safeParse(unmarshalledItems);

      if (!tokenGenStatesEntries.success) {
        throw genericInternalError(
          `Unable to parse toke-generation-states entries: result ${JSON.stringify(
            tokenGenStatesEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      if (!data.LastEvaluatedKey) {
        return tokenGenStatesEntries.data;
      } else {
        return [
          ...tokenGenStatesEntries.data,
          ...(await runPaginatedQuery(
            gsiPKConsumerIdEServiceId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(
    gsiPKConsumerIdEServiceId,
    dynamoDBClient,
    undefined
  );
};

export const writePlatformCatalogEntry = async (
  catalogEntry: PlatformStatesCatalogEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: catalogEntry.PK,
      },
      state: {
        S: catalogEntry.state,
      },
      descriptorAudience: {
        L: catalogEntry.descriptorAudience.map((item) => ({
          S: item,
        })),
      },
      descriptorVoucherLifespan: {
        N: catalogEntry.descriptorVoucherLifespan.toString(),
      },
      version: {
        N: catalogEntry.version.toString(),
      },
      updatedAt: {
        S: catalogEntry.updatedAt,
      },
    },
    TableName: "platform-states",
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

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
    TableName: "platform-states",
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const writePlatformAgreementEntry = async (
  agreementEntry: PlatformStatesAgreementEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: agreementEntry.PK,
      },
      state: {
        S: agreementEntry.state,
      },
      version: {
        N: agreementEntry.version.toString(),
      },
      updatedAt: {
        S: agreementEntry.updatedAt,
      },
      agreementId: {
        S: agreementEntry.agreementId,
      },
      agreementTimestamp: {
        S: agreementEntry.agreementTimestamp,
      },
      agreementDescriptorId: {
        S: agreementEntry.agreementDescriptorId,
      },
    },
    TableName: "platform-states",
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const writePlatformStatesClientEntry = async (
  clientEntry: PlatformStatesClientEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: clientEntry.PK,
      },
      state: {
        S: clientEntry.state,
      },
      clientPurposesIds: {
        L: clientEntry.clientPurposesIds.map((purposeId) => ({
          S: purposeId,
        })),
      },
      clientKind: {
        S: clientEntry.clientKind,
      },
      clientConsumerId: {
        S: clientEntry.clientConsumerId,
      },
      version: {
        N: clientEntry.version.toString(),
      },
      updatedAt: {
        S: clientEntry.updatedAt,
      },
    },
    TableName: "platform-states",
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};
