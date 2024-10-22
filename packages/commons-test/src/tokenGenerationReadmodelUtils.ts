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
  GSIPKConsumerIdEServiceId,
  GSIPKEServiceIdDescriptorId,
  PlatformStatesCatalogEntry,
  PlatformStatesGenericEntry,
  TokenGenerationStatesClientPurposeEntry,
  PlatformStatesPurposeEntry,
  PlatformStatesAgreementEntry,
  TokenGenerationStatesGenericEntry,
  TokenGenerationStatesClientEntry,
} from "pagopa-interop-models";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { z } from "zod";

export const writeTokenStateClientPurposeEntry = async (
  tokenStateEntry: TokenGenerationStatesClientPurposeEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: tokenStateEntry.PK,
      },
      ...(tokenStateEntry.descriptorState
        ? {
            descriptorState: {
              S: tokenStateEntry.descriptorState,
            },
          }
        : {}),
      ...(tokenStateEntry.descriptorAudience
        ? {
            descriptorAudience: {
              L: tokenStateEntry.descriptorAudience.map((item) => ({
                S: item,
              })),
            },
          }
        : {}),
      ...(tokenStateEntry.descriptorVoucherLifespan
        ? {
            descriptorVoucherLifespan: {
              N: tokenStateEntry.descriptorVoucherLifespan.toString(),
            },
          }
        : {}),
      updatedAt: {
        S: tokenStateEntry.updatedAt,
      },
      consumerId: {
        S: tokenStateEntry.consumerId,
      },
      ...(tokenStateEntry.agreementId
        ? {
            agreementId: {
              S: tokenStateEntry.agreementId,
            },
          }
        : {}),
      ...(tokenStateEntry.purposeVersionId
        ? {
            purposeVersionId: {
              S: tokenStateEntry.purposeVersionId,
            },
          }
        : {}),
      ...(tokenStateEntry.GSIPK_consumerId_eserviceId
        ? {
            GSIPK_consumerId_eserviceId: {
              S: tokenStateEntry.GSIPK_consumerId_eserviceId,
            },
          }
        : {}),
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
      ...(tokenStateEntry.GSIPK_clientId_purposeId
        ? {
            GSIPK_clientId_purposeId: {
              S: tokenStateEntry.GSIPK_clientId_purposeId,
            },
          }
        : {}),
      ...(tokenStateEntry.agreementState
        ? {
            agreementState: {
              S: tokenStateEntry.agreementState,
            },
          }
        : {}),
      ...(tokenStateEntry.GSIPK_eserviceId_descriptorId
        ? {
            GSIPK_eserviceId_descriptorId: {
              S: tokenStateEntry.GSIPK_eserviceId_descriptorId,
            },
          }
        : {}),
      ...(tokenStateEntry.GSIPK_purposeId
        ? {
            GSIPK_purposeId: {
              S: tokenStateEntry.GSIPK_purposeId,
            },
          }
        : {}),
      ...(tokenStateEntry.purposeState
        ? {
            purposeState: {
              S: tokenStateEntry.purposeState,
            },
          }
        : {}),
    },
    TableName: "token-generation-states",
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const writeTokenStateClientEntry = async (
  tokenStateEntry: TokenGenerationStatesClientEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: tokenStateEntry.PK,
      },
      updatedAt: {
        S: tokenStateEntry.updatedAt,
      },
      consumerId: {
        S: tokenStateEntry.consumerId,
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
    },
    TableName: "token-generation-states",
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const writeTokenStateEntry = async (
  tokenStateEntry: TokenGenerationStatesClientPurposeEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const agreementItems: Record<string, AttributeValue> =
    tokenStateEntry.GSIPK_consumerId_eserviceId
      ? {
          agreementId: {
            S: tokenStateEntry.agreementId!,
          },
          agreementState: {
            S: tokenStateEntry.agreementState!,
          },
          GSIPK_consumerId_eserviceId: {
            S: tokenStateEntry.GSIPK_consumerId_eserviceId,
          },
        }
      : {};
  const descriptorItems: Record<string, AttributeValue> =
    tokenStateEntry.GSIPK_eserviceId_descriptorId
      ? {
          descriptorState: {
            S: tokenStateEntry.descriptorState!,
          },
          descriptorAudience: {
            L: tokenStateEntry.descriptorAudience!.map((item) => ({
              S: item,
            })),
          },
          descriptorVoucherLifespan: {
            N: tokenStateEntry.descriptorVoucherLifespan!.toString(),
          },
          GSIPK_eserviceId_descriptorId: {
            S: tokenStateEntry.GSIPK_eserviceId_descriptorId,
          },
        }
      : {};
  const items: Record<string, AttributeValue> = {
    ...agreementItems,
    ...descriptorItems,
    PK: {
      S: tokenStateEntry.PK,
    },
    updatedAt: {
      S: tokenStateEntry.updatedAt,
    },
    consumerId: {
      S: tokenStateEntry.consumerId,
    },
    purposeVersionId: {
      S: tokenStateEntry.purposeVersionId!,
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
    GSIPK_purposeId: {
      S: tokenStateEntry.GSIPK_purposeId!,
    },
    purposeState: {
      S: tokenStateEntry.purposeState!,
    },
  };

  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: items,
    TableName: "token-generation-states",
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const readAllTokenStateItems = async (
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesGenericEntry[]> => {
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
      .array(TokenGenerationStatesGenericEntry)
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

export const readAllPlatformStateItems = async (
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

export const readTokenStateEntriesByConsumerIdEserviceId = async (
  consumerId_eserviceId: GSIPKConsumerIdEServiceId,
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
  const runPaginatedQuery = async (
    consumerId_eserviceId: GSIPKConsumerIdEServiceId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
    const input: QueryInput = {
      TableName: "token-generation-states",
      IndexName: "Agreement",
      KeyConditionExpression: `GSIPK_consumerId_eserviceId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: consumerId_eserviceId },
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
            consumerId_eserviceId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(
    consumerId_eserviceId,
    dynamoDBClient,
    undefined
  );
};

export const writeCatalogEntry = async (
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
      GSIPK_consumerId_eserviceId: {
        S: agreementEntry.GSIPK_consumerId_eserviceId,
      },
      GSISK_agreementTimestamp: {
        S: agreementEntry.GSISK_agreementTimestamp,
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
