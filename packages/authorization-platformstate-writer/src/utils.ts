import {
  AttributeValue,
  DeleteItemCommand,
  DeleteItemInput,
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
  QueryCommand,
  QueryCommandOutput,
  QueryInput,
} from "@aws-sdk/client-dynamodb";
import {
  AgreementId,
  ClientId,
  clientKind,
  ClientKind,
  clientKindTokenStates,
  ClientKindTokenStates,
  genericInternalError,
  GSIPKClientIdPurposeId,
  GSIPKConsumerIdEServiceId,
  GSIPKKid,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makeGSIPKKid,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesAgreementEntry,
  PlatformStatesAgreementPK,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesClientPK,
  PlatformStatesEServiceDescriptorPK,
  PlatformStatesPurposeEntry,
  PlatformStatesPurposePK,
  PurposeId,
  TenantId,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesClientPurposeEntry,
  TokenGenerationStatesGenericEntry,
} from "pagopa-interop-models";
import { z } from "zod";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { match } from "ts-pattern";
import { UpdateItemInput } from "@aws-sdk/client-dynamodb";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { Logger } from "pagopa-interop-commons";
import { config } from "./config/config.js";

export const deleteEntriesFromTokenStatesByKid = async (
  GSIPK_kid: GSIPKKid,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const runPaginatedQuery = async (
    GSIPK_kid: GSIPKKid,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<void> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Kid",
      KeyConditionExpression: `GSIPK_kid = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: GSIPK_kid },
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
        .array(TokenGenerationStatesGenericEntry)
        .safeParse(unmarshalledItems);

      if (!tokenStateEntries.success) {
        throw genericInternalError(
          `Unable to parse token state entry item: result ${JSON.stringify(
            tokenStateEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      for (const entry of tokenStateEntries.data) {
        await deleteClientEntryFromTokenGenerationStatesTable(
          entry,
          dynamoDBClient
        );
      }

      if (data.LastEvaluatedKey) {
        await runPaginatedQuery(
          GSIPK_kid,
          dynamoDBClient,
          data.LastEvaluatedKey
        );
      }
    }
  };

  await runPaginatedQuery(GSIPK_kid, dynamoDBClient, undefined);
};

export const deleteClientEntryFromPlatformStates = async (
  pk: PlatformStatesClientPK,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: DeleteItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new DeleteItemCommand(input);
  await dynamoDBClient.send(command);
};

export const deleteEntriesFromTokenStatesByClient = async (
  GSIPK_client: ClientId,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const runPaginatedQuery = async (
    GSIPK_client: ClientId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<void> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Client",
      KeyConditionExpression: `GSIPK_clientId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: GSIPK_client },
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
        .array(TokenGenerationStatesGenericEntry)
        .safeParse(unmarshalledItems);

      if (!tokenStateEntries.success) {
        throw genericInternalError(
          `Unable to parse token state entry item: result ${JSON.stringify(
            tokenStateEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      for (const entry of tokenStateEntries.data) {
        await deleteClientEntryFromTokenGenerationStatesTable(
          entry,
          dynamoDBClient
        );
      }

      if (data.LastEvaluatedKey) {
        await runPaginatedQuery(
          GSIPK_client,
          dynamoDBClient,
          data.LastEvaluatedKey
        );
      }
    }
  };

  await runPaginatedQuery(GSIPK_client, dynamoDBClient, undefined);
};

export const deleteClientEntryFromTokenGenerationStatesTable = async (
  entryToDelete: TokenGenerationStatesGenericEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: DeleteItemInput = {
    Key: {
      PK: { S: entryToDelete.PK },
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new DeleteItemCommand(input);
  await dynamoDBClient.send(command);
};

export const readClientEntry = async (
  primaryKey: PlatformStatesClientPK,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesClientEntry | undefined> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Item);
    const clientEntry = PlatformStatesClientEntry.safeParse(unmarshalled);

    if (!clientEntry.success) {
      throw genericInternalError(
        `Unable to parse client entry item: result ${JSON.stringify(
          clientEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return clientEntry.data;
  }
};

const readTokenStateEntriesByGSIPKClientPurpose = async (
  GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
  dynamoDBClient: DynamoDBClient,
  exclusiveStartKey?: Record<string, AttributeValue>
): Promise<{
  tokenStateEntries: TokenGenerationStatesClientPurposeEntry[];
  lastEvaluatedKey: Record<string, AttributeValue> | undefined;
}> => {
  const input: QueryInput = {
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    IndexName: "ClientPurpose",
    KeyConditionExpression: `GSIPK_clientId_purposeId = :gsiValue`,
    ExpressionAttributeValues: {
      ":gsiValue": { S: GSIPK_clientId_purposeId },
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
    return {
      tokenStateEntries: tokenStateEntries.data,
      lastEvaluatedKey: data.LastEvaluatedKey,
    };
  }
};

export const deleteEntriesWithClientAndPurposeFromTokenGenerationStatesTable =
  async (
    GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
    dynamoDBClient: DynamoDBClient
  ): Promise<void> => {
    const runPaginatedQuery = async (
      GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
      dynamoDBClient: DynamoDBClient,
      exclusiveStartKey?: Record<string, AttributeValue>
    ): Promise<void> => {
      const res = await readTokenStateEntriesByGSIPKClientPurpose(
        GSIPK_clientId_purposeId,
        dynamoDBClient,
        exclusiveStartKey
      );

      for (const entry of res.tokenStateEntries) {
        await deleteClientEntryFromTokenGenerationStatesTable(
          entry,
          dynamoDBClient
        );
      }

      if (res.lastEvaluatedKey) {
        await runPaginatedQuery(
          GSIPK_clientId_purposeId,
          dynamoDBClient,
          res.lastEvaluatedKey
        );
      }
    };
    await runPaginatedQuery(GSIPK_clientId_purposeId, dynamoDBClient);
  };

export const convertEntriesToClientKidInTokenGenerationStates = async (
  GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const runPaginatedQuery = async (
    GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
    const res = await readTokenStateEntriesByGSIPKClientPurpose(
      GSIPK_clientId_purposeId,
      dynamoDBClient,
      exclusiveStartKey
    );

    // convert entries
    for (const entry of res.tokenStateEntries) {
      const newEntry: TokenGenerationStatesClientEntry = {
        PK: makeTokenGenerationStatesClientKidPK({
          clientId: entry.GSIPK_clientId,
          kid: entry.GSIPK_kid,
        }),
        consumerId: entry.consumerId,
        clientKind: entry.clientKind,
        publicKey: entry.publicKey,
        GSIPK_clientId: entry.GSIPK_clientId,
        GSIPK_kid: entry.GSIPK_kid,
        updatedAt: new Date().toISOString(),
      };

      // write the new one
      await writeTokenStateClientEntry(newEntry, dynamoDBClient);

      // delete the old one
      await deleteClientEntryFromTokenGenerationStatesTable(
        entry,
        dynamoDBClient
      );
    }

    if (!res.lastEvaluatedKey) {
      return res.tokenStateEntries;
    } else {
      return [
        ...res.tokenStateEntries,
        ...(await runPaginatedQuery(
          GSIPK_clientId_purposeId,
          dynamoDBClient,
          res.lastEvaluatedKey
        )),
      ];
    }
  };
  await runPaginatedQuery(GSIPK_clientId_purposeId, dynamoDBClient);
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
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const readCatalogEntry = async (
  primaryKey: PlatformStatesEServiceDescriptorPK,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesCatalogEntry | undefined> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Item);
    const catalogEntry = PlatformStatesCatalogEntry.safeParse(unmarshalled);

    if (!catalogEntry.success) {
      throw genericInternalError(
        `Unable to parse catalog entry item: result ${JSON.stringify(
          catalogEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return catalogEntry.data;
  }
};

export const readPlatformAgreementEntryByGSIPKConsumerIdEServiceId = async (
  gsiPKConsumerIdEServiceId: GSIPKConsumerIdEServiceId,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesAgreementEntry | undefined> => {
  const input: QueryInput = {
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    IndexName: "Agreement",
    KeyConditionExpression: `GSIPK_consumerId_eserviceId = :gsiValue`,
    ExpressionAttributeValues: {
      ":gsiValue": { S: gsiPKConsumerIdEServiceId },
    },
    ScanIndexForward: false,
  };
  const command = new QueryCommand(input);
  const data: QueryCommandOutput = await dynamoDBClient.send(command);

  if (!data.Items) {
    return undefined;
  } else {
    const unmarshalledItems = data.Items.map((item) => unmarshall(item));
    const platformAgreementEntries = z
      .array(PlatformStatesAgreementEntry)
      .safeParse(unmarshalledItems);

    if (platformAgreementEntries.success) {
      return platformAgreementEntries.data[0];
    } else {
      throw genericInternalError(
        `Unable to parse platform agreement entries: result ${JSON.stringify(
          platformAgreementEntries
        )} `
      );
    }
  }
};

export const readPlatformPurposeEntry = async (
  primaryKey: PlatformStatesPurposePK,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesPurposeEntry | undefined> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Item);
    const purposeEntry = PlatformStatesPurposeEntry.safeParse(unmarshalled);

    if (!purposeEntry.success) {
      throw genericInternalError(
        `Unable to parse purpose entry item: result ${JSON.stringify(
          purposeEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return purposeEntry.data;
  }
};

export const upsertTokenStateClientPurposeEntry = async (
  tokenStateEntry: TokenGenerationStatesClientPurposeEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
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
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const clientKindToTokenGenerationStatesClientKind = (
  kind: ClientKind
): ClientKindTokenStates =>
  match<ClientKind, ClientKindTokenStates>(kind)
    .with(clientKind.consumer, () => clientKindTokenStates.consumer)
    .with(clientKind.api, () => clientKindTokenStates.api)
    .exhaustive();

export const writeClientEntry = async (
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
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const readClientEntriesInTokenGenerationStates = async (
  GSIPK_clientId: ClientId,
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesGenericEntry[]> => {
  const runPaginatedQuery = async (
    GSIPK_clientId: ClientId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenerationStatesGenericEntry[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Client",
      KeyConditionExpression: `GSIPK_clientId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: GSIPK_clientId },
      },
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false,
    };
    const command = new QueryCommand(input);
    const data: QueryCommandOutput = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read platform state client entries: result ${JSON.stringify(
          data
        )} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const clientEntries = z
        .array(TokenGenerationStatesGenericEntry)
        .safeParse(unmarshalledItems);

      if (!clientEntries.success) {
        throw genericInternalError(
          `Unable to parse token state entry items: result ${JSON.stringify(
            clientEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      if (!data.LastEvaluatedKey) {
        return clientEntries.data;
      } else {
        return [
          ...clientEntries.data,
          ...(await runPaginatedQuery(
            GSIPK_clientId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(GSIPK_clientId, dynamoDBClient, undefined);
};

export const setClientPurposeIdsInPlatformStatesEntry = async (
  {
    primaryKey,
    version,
    clientPurposeIds,
  }: {
    primaryKey: PlatformStatesClientPK;
    version: number;
    clientPurposeIds: PurposeId[];
  },
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: UpdateItemInput = {
    ConditionExpression: "attribute_exists(PK)",
    Key: {
      PK: {
        S: primaryKey,
      },
    },
    ExpressionAttributeValues: {
      ":clientPurposesIds": {
        L: clientPurposeIds.map((purposeId) => ({
          S: purposeId,
        })),
      },
      ":newVersion": {
        N: version.toString(),
      },
      ":newUpdatedAt": {
        S: new Date().toISOString(),
      },
    },
    UpdateExpression:
      "SET clientPurposesIds = :clientPurposesIds, updatedAt = :newUpdatedAt, version = :newVersion",
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
};

export const extractKidFromTokenEntryPK = (
  pk: TokenGenerationStatesClientKidPK | TokenGenerationStatesClientKidPurposePK
): string => pk.split("#")[2];

export const extractAgreementIdFromAgreementPK = (
  pk: PlatformStatesAgreementPK
): AgreementId => {
  const substrings = pk.split("#");
  const agreementId = substrings[1];
  const result = AgreementId.safeParse(agreementId);

  if (!result.success) {
    throw genericInternalError(
      `Unable to parse agreement PK: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(agreementId)} `
    );
  }
  return result.data;
};

export const retrievePlatformStatesByPurpose = async (
  purposeId: PurposeId,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<{
  purposeEntry?: PlatformStatesPurposeEntry;
  agreementEntry?: PlatformStatesAgreementEntry;
  catalogEntry?: PlatformStatesCatalogEntry;
}> => {
  const purposePK = makePlatformStatesPurposePK(purposeId);
  const purposeEntry = await readPlatformPurposeEntry(
    purposePK,
    dynamoDBClient
  );

  logger.info(
    `Retrieving purpose entry ${purposePK} to add purpose info in token-generation-states`
  );

  if (!purposeEntry) {
    return {
      purposeEntry: undefined,
    };
  }

  const agreementGSI = makeGSIPKConsumerIdEServiceId({
    eserviceId: purposeEntry.purposeEserviceId,
    consumerId: purposeEntry.purposeConsumerId,
  });

  logger.info(
    `Retrieving agreement entry with GSIPK_consumerId_eserviceId ${agreementGSI} to add agreement info in token-generation-states`
  );

  const agreementEntry =
    await readPlatformAgreementEntryByGSIPKConsumerIdEServiceId(
      agreementGSI,
      dynamoDBClient
    );

  if (!agreementEntry) {
    return {
      purposeEntry,
      agreementEntry: undefined,
    };
  }

  const catalogPK = makePlatformStatesEServiceDescriptorPK({
    eserviceId: purposeEntry.purposeEserviceId,
    descriptorId: agreementEntry.agreementDescriptorId,
  });
  logger.info(
    `Retrieving catalog entry ${catalogPK} to add descriptor info in token-generation-states`
  );
  const catalogEntry = await readCatalogEntry(catalogPK, dynamoDBClient);

  if (!catalogEntry) {
    return {
      purposeEntry,
      agreementEntry,
      catalogEntry: undefined,
    };
  }
  return {
    purposeEntry,
    agreementEntry,
    catalogEntry,
  };
};

export const upsertPlatformClientEntry = async (
  entry: PlatformStatesClientEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    Item: {
      PK: {
        S: entry.PK,
      },
      state: {
        S: entry.state,
      },
      clientPurposesIds: {
        L: entry.clientPurposesIds.map((purposeId) => ({
          S: purposeId,
        })),
      },
      clientKind: {
        S: entry.clientKind,
      },
      clientConsumerId: {
        S: entry.clientConsumerId,
      },
      version: {
        N: entry.version.toString(),
      },
      updatedAt: {
        S: entry.updatedAt,
      },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const upsertTokenClientKidEntry = async (
  entry: TokenGenerationStatesClientEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    Item: {
      PK: {
        S: entry.PK,
      },
      consumerId: {
        S: entry.consumerId,
      },
      clientKind: {
        S: entry.clientKind,
      },
      publicKey: {
        S: entry.publicKey,
      },
      GSIPK_clientId: {
        S: entry.GSIPK_clientId,
      },
      GSIPK_kid: {
        S: entry.GSIPK_kid,
      },
      updatedAt: {
        S: entry.updatedAt,
      },
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};

export const updateTokenDataForSecondRetrieval = async ({
  dynamoDBClient,
  entry,
  purposeEntry,
  agreementEntry,
  catalogEntry,
}: {
  dynamoDBClient: DynamoDBClient;
  entry: TokenGenerationStatesClientPurposeEntry;
  purposeEntry?: PlatformStatesPurposeEntry;
  agreementEntry?: PlatformStatesAgreementEntry;
  catalogEntry?: PlatformStatesCatalogEntry;
}): Promise<void> => {
  const setIfChanged = <
    K extends keyof TokenGenerationStatesClientPurposeEntry
  >(
    key: K,
    newValue: TokenGenerationStatesClientPurposeEntry[K]
  ): Partial<TokenGenerationStatesClientPurposeEntry> => {
    const oldValue = entry[key];

    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      return !oldValue.every((value) => newValue.includes(value))
        ? { [key]: newValue }
        : {};
    }

    return oldValue !== newValue ? { [key]: newValue } : {};
  };
  const updatedFields: Partial<TokenGenerationStatesClientPurposeEntry> = {
    ...(purposeEntry
      ? {
          ...setIfChanged(
            "GSIPK_consumerId_eserviceId",
            makeGSIPKConsumerIdEServiceId({
              consumerId: purposeEntry.purposeConsumerId,
              eserviceId: purposeEntry.purposeEserviceId,
            })
          ),
          ...setIfChanged("purposeVersionId", purposeEntry.purposeVersionId),
          ...setIfChanged("purposeState", purposeEntry.state),
        }
      : {}),
    ...(purposeEntry && agreementEntry
      ? {
          ...setIfChanged(
            "GSIPK_eserviceId_descriptorId",
            makeGSIPKEServiceIdDescriptorId({
              eserviceId: purposeEntry.purposeEserviceId,
              descriptorId: agreementEntry.agreementDescriptorId,
            })
          ),
          ...setIfChanged("agreementState", agreementEntry.state),
        }
      : {}),
    ...(catalogEntry
      ? {
          ...setIfChanged(
            "descriptorAudience",
            catalogEntry.descriptorAudience
          ),
          ...setIfChanged(
            "descriptorVoucherLifespan",
            catalogEntry.descriptorVoucherLifespan
          ),
          ...setIfChanged("descriptorState", catalogEntry.state),
        }
      : {}),
  };

  if (Object.keys(updatedFields).length > 0) {
    const { expressionAttributeValues, updateExpression } =
      generateUpdateItemInputData(updatedFields);

    const input: UpdateItemInput = {
      ConditionExpression: "attribute_exists(PK)",
      Key: {
        PK: {
          S: entry.PK,
        },
      },
      ExpressionAttributeValues: expressionAttributeValues,
      UpdateExpression: updateExpression,
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "NONE",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
  }
};

const convertValueToAttributeValue = (
  value: string | number | boolean | Array<string | number | boolean>
): AttributeValue => {
  if (typeof value === "string") {
    return { S: value };
  } else if (typeof value === "number") {
    return { N: value.toString() };
  } else if (typeof value === "boolean") {
    return { BOOL: value };
  } else if (Array.isArray(value)) {
    return { L: value.map((item) => convertValueToAttributeValue(item)) };
  } else {
    throw genericInternalError(
      `Unsupported DynamoDB type ${typeof value} while converting to AttributeValue`
    );
  }
};

const convertToExpressionAttributeValues = (
  updatedFields: Partial<TokenGenerationStatesClientPurposeEntry>
): Record<string, AttributeValue> => {
  const expressionAttributeValues = Object.keys(updatedFields).reduce(
    (acc, key) => {
      const value = updatedFields[key as keyof typeof updatedFields];
      if (value !== undefined) {
        const dynamoKey = `:${key}`;
        return {
          ...acc,
          [dynamoKey]: convertValueToAttributeValue(value),
        };
      }
      return acc;
    },
    {}
  );

  return {
    ...expressionAttributeValues,
    ":newUpdatedAt": { S: new Date().toISOString() },
  };
};

const generateUpdateItemInputData = (
  updatedFields: Partial<TokenGenerationStatesClientPurposeEntry>
): {
  updateExpression: string;
  expressionAttributeValues: Record<string, AttributeValue>;
} => {
  const expressionAttributeValues =
    convertToExpressionAttributeValues(updatedFields);

  const updateExpressionTmp = Object.keys(updatedFields)
    .map((key) => `${key} = :${key}`)
    .join(", ");

  const updateExpression = `SET updatedAt = :newUpdatedAt, ${updateExpressionTmp}`;

  return {
    updateExpression,
    expressionAttributeValues,
  };
};

export const createTokenClientPurposeEntry = ({
  tokenEntry: baseEntry,
  kid,
  clientId,
  consumerId,
  purposeId,
  purposeEntry,
  agreementEntry,
  catalogEntry,
}: {
  tokenEntry: TokenGenerationStatesGenericEntry;
  kid: string;
  clientId: ClientId;
  consumerId: TenantId;
  purposeId: PurposeId;
  purposeEntry?: PlatformStatesPurposeEntry;
  agreementEntry?: PlatformStatesAgreementEntry;
  catalogEntry?: PlatformStatesCatalogEntry;
}): TokenGenerationStatesClientPurposeEntry => {
  const pk = makeTokenGenerationStatesClientKidPurposePK({
    clientId,
    kid,
    purposeId,
  });
  const isTokenClientPurposeEntry =
    TokenGenerationStatesClientPurposeEntry.safeParse(baseEntry).success;

  return {
    PK: pk,
    consumerId: baseEntry.consumerId,
    updatedAt: new Date().toISOString(),
    clientKind: isTokenClientPurposeEntry
      ? baseEntry.clientKind
      : clientKindTokenStates.consumer,
    publicKey: baseEntry.publicKey,
    GSIPK_clientId: baseEntry.GSIPK_clientId,
    GSIPK_kid: isTokenClientPurposeEntry
      ? baseEntry.GSIPK_kid
      : makeGSIPKKid(kid),
    GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
      clientId,
      purposeId,
    }),
    GSIPK_purposeId: purposeId,
    ...(purposeEntry && {
      GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId: purposeEntry.purposeEserviceId,
      }),
      purposeState: purposeEntry.state,
      purposeVersionId: purposeEntry.purposeVersionId,
    }),
    ...(purposeEntry &&
      agreementEntry && {
        agreementId: extractAgreementIdFromAgreementPK(agreementEntry.PK),
        agreementState: agreementEntry.state,
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: purposeEntry.purposeEserviceId,
          descriptorId: agreementEntry.agreementDescriptorId,
        }),
      }),
    ...(catalogEntry && {
      descriptorState: catalogEntry.state,
      descriptorAudience: catalogEntry.descriptorAudience,
      descriptorVoucherLifespan: catalogEntry.descriptorVoucherLifespan,
    }),
  };
};
