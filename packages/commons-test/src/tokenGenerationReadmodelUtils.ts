import {
  DynamoDBClient,
  PutItemCommand,
  PutItemInput,
  ScanCommand,
  ScanInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  genericInternalError,
  PlatformStatesCatalogEntry,
  PlatformStatesGenericEntry,
  TokenGenerationStatesConsumerClient,
  PlatformStatesPurposeEntry,
  PlatformStatesAgreementEntry,
  TokenGenerationStatesGenericClient,
  TokenGenerationStatesApiClient,
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
      ...(tokenGenStatesEntry.adminId
        ? {
            adminId: { S: tokenGenStatesEntry.adminId },
          }
        : {}),
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
      ...(tokenGenStatesEntry.producerId
        ? {
            producerId: {
              S: tokenGenStatesEntry.producerId,
            },
          }
        : {}),
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
  const data = await dynamoDBClient.send(commandQuery);

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
  const data = await dynamoDBClient.send(commandQuery);

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
      producerId: {
        S: agreementEntry.producerId,
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
