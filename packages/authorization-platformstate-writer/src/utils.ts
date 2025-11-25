import {
  AttributeValue,
  DeleteItemCommand,
  DeleteItemInput,
  DynamoDBClient,
  GetItemCommand,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
  ScanCommand,
  ScanInput,
  UpdateItemCommand,
  UpdateItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  ClientId,
  clientKind,
  ClientKind,
  clientKindTokenGenStates,
  ClientKindTokenGenStates,
  genericInternalError,
  GSIPKClientIdPurposeId,
  GSIPKClientIdKid,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesAgreementPK,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesClientPK,
  PlatformStatesEServiceDescriptorPK,
  PlatformStatesPurposeEntry,
  PlatformStatesPurposePK,
  PurposeId,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesConsumerClient,
  Client,
  TokenGenerationStatesGenericClient,
  TenantId,
  makeGSIPKClientIdKid,
  clientKidPrefix,
  clientKidPurposePrefix,
  PlatformStatesAgreementEntry,
  makePlatformStatesAgreementPK,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import { z } from "zod";
import { config } from "./config/config.js";

const runPaginatedQueryDeleteClientEntryFromTokenGenStatesByPrefixV1 = async (
  prefix: string,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  // eslint-disable-next-line functional/no-let
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const readInput: ScanInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      FilterExpression: "begins_with(#pk, :prefix)",
      ExpressionAttributeNames: {
        "#pk": "PK",
      },
      ExpressionAttributeValues: {
        ":prefix": { S: prefix },
      },
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

      for (const entry of tokenGenStatesEntries.data) {
        await deleteClientEntryFromTokenGenerationStates(
          entry.PK,
          dynamoDBClient,
          logger
        );
      }

      exclusiveStartKey = data.LastEvaluatedKey;
    }
  } while (exclusiveStartKey);
};

export const deleteEntriesFromTokenGenStatesByClientIdKidV1 = async (
  clientId: ClientId,
  kid: string,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  const prefix1 = `${clientKidPrefix}${clientId}#${kid}`;
  const prefix2 = `${clientKidPurposePrefix}${clientId}#${kid}`;

  await runPaginatedQueryDeleteClientEntryFromTokenGenStatesByPrefixV1(
    prefix1,
    dynamoDBClient,
    logger
  );
  await runPaginatedQueryDeleteClientEntryFromTokenGenStatesByPrefixV1(
    prefix2,
    dynamoDBClient,
    logger
  );
};

export const deleteEntriesFromTokenGenStatesByClientIdKidV2 = async (
  client: Client,
  kid: string,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  if (client.purposes.length > 0) {
    await Promise.all(
      client.purposes.map(async (purposeId) => {
        const pk = makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid,
          purposeId,
        });
        await deleteClientEntryFromTokenGenerationStates(
          pk,
          dynamoDBClient,
          logger
        );
      })
    );
  } else {
    const pk = makeTokenGenerationStatesClientKidPK({
      clientId: client.id,
      kid,
    });
    await deleteClientEntryFromTokenGenerationStates(
      pk,
      dynamoDBClient,
      logger
    );
  }
};

export const deleteClientEntryFromPlatformStates = async (
  pk: PlatformStatesClientPK,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  const input: DeleteItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new DeleteItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(`Platform-states. Deleted client entry ${pk}`);
};

export const deleteEntriesFromTokenGenStatesByClientIdV1 = async (
  clientId: ClientId,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  // We need to find all the entries to delete though a Scan, because the query on the GSI doesn't allow ConsistentRead

  const prefix1 = `${clientKidPrefix}${clientId}`;
  const prefix2 = `${clientKidPurposePrefix}${clientId}`;

  await runPaginatedQueryDeleteClientEntryFromTokenGenStatesByPrefixV1(
    prefix1,
    dynamoDBClient,
    logger
  );
  await runPaginatedQueryDeleteClientEntryFromTokenGenStatesByPrefixV1(
    prefix2,
    dynamoDBClient,
    logger
  );
};

export const deleteEntriesFromTokenGenStatesByClientIdV2 = async (
  // For v2 events we have the entire client, so we can build all the PKs of the entries we need to delete
  client: Client,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  if (client.purposes.length > 0) {
    await Promise.all(
      client.keys.flatMap((key) =>
        client.purposes.map(async (purpose) => {
          const pk = makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: key.kid,
            purposeId: purpose,
          });
          await deleteClientEntryFromTokenGenerationStates(
            pk,
            dynamoDBClient,
            logger
          );
        })
      )
    );
  } else {
    await Promise.all(
      client.keys.map(async (key) => {
        const pk = makeTokenGenerationStatesClientKidPK({
          clientId: client.id,
          kid: key.kid,
        });
        await deleteClientEntryFromTokenGenerationStates(
          pk,
          dynamoDBClient,
          logger
        );
      })
    );
  }
};

export const deleteClientEntryFromTokenGenerationStates = async (
  entryToDeletePK:
    | TokenGenerationStatesClientKidPK
    | TokenGenerationStatesClientKidPurposePK,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  const input: DeleteItemInput = {
    Key: {
      PK: { S: entryToDeletePK },
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new DeleteItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(`Token-generation-states. Deleted entry ${entryToDeletePK}`);
};

export const readPlatformClientEntry = async (
  primaryKey: PlatformStatesClientPK,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesClientEntry | undefined> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ConsistentRead: true,
  };
  const command = new GetItemCommand(input);
  const data = await dynamoDBClient.send(command);

  if (!data.Item) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Item);
    const clientEntry = PlatformStatesClientEntry.safeParse(unmarshalled);

    if (!clientEntry.success) {
      throw genericInternalError(
        `Unable to parse platform-states client entry: result ${JSON.stringify(
          clientEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return clientEntry.data;
  }
};

const readTokenGenStatesConsumerClientsByClientPurposeV1 = async (
  GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
  dynamoDBClient: DynamoDBClient,
  exclusiveStartKey?: Record<string, AttributeValue>
): Promise<{
  tokenGenStatesEntries: TokenGenerationStatesConsumerClient[];
  lastEvaluatedKey: Record<string, AttributeValue> | undefined;
}> => {
  // This function performs a Scan because ConsistentRead can't be used on GSIPKs
  const readInput: ScanInput = {
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    FilterExpression: `GSIPK_clientId_purposeId = :gsiValue`,
    ExpressionAttributeValues: {
      ":gsiValue": { S: GSIPK_clientId_purposeId },
    },
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
      .array(TokenGenerationStatesConsumerClient)
      .safeParse(unmarshalledItems);

    if (!tokenGenStatesEntries.success) {
      throw genericInternalError(
        `Unable to parse token-generation-states entries: result ${JSON.stringify(
          tokenGenStatesEntries
        )} - data ${JSON.stringify(data)} `
      );
    }

    return {
      tokenGenStatesEntries: tokenGenStatesEntries.data,
      lastEvaluatedKey: data.LastEvaluatedKey,
    };
  }
};

export const deleteEntriesFromTokenGenStatesByClientIdPurposeIdV2 = async (
  client: Client,
  purposeId: PurposeId,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  // For v2 events we have the entire client, so we can build all the PKs of the entries we need to delete
  await Promise.all(
    client.keys.map(async (key) => {
      const pk = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: key.kid,
        purposeId,
      });
      await deleteClientEntryFromTokenGenerationStates(
        pk,
        dynamoDBClient,
        logger
      );
    })
  );
};

export const deleteEntriesFromTokenGenStatesByClientIdPurposeIdV1 = async (
  GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  // eslint-disable-next-line functional/no-let
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const { tokenGenStatesEntries, lastEvaluatedKey } =
      await readTokenGenStatesConsumerClientsByClientPurposeV1(
        GSIPK_clientId_purposeId,
        dynamoDBClient,
        exclusiveStartKey
      );

    for (const entry of tokenGenStatesEntries) {
      await deleteClientEntryFromTokenGenerationStates(
        entry.PK,
        dynamoDBClient,
        logger
      );
    }

    exclusiveStartKey = lastEvaluatedKey;
  } while (exclusiveStartKey);
};

export const convertEntriesToClientKidInTokenGenerationStates = async (
  GSIPK_clientId_purposeId: GSIPKClientIdPurposeId,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  // eslint-disable-next-line functional/no-let
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const { tokenGenStatesEntries, lastEvaluatedKey } =
      await readTokenGenStatesConsumerClientsByClientPurposeV1(
        GSIPK_clientId_purposeId,
        dynamoDBClient,
        exclusiveStartKey
      );

    // convert entries
    for (const entry of tokenGenStatesEntries) {
      const newEntry: TokenGenerationStatesConsumerClient = {
        PK: makeTokenGenerationStatesClientKidPK({
          clientId: entry.GSIPK_clientId,
          kid: extractKidFromGSIClientKid(entry.GSIPK_clientId_kid),
        }),
        consumerId: entry.consumerId,
        clientKind: entry.clientKind,
        publicKey: entry.publicKey,
        GSIPK_clientId: entry.GSIPK_clientId,
        GSIPK_clientId_kid: entry.GSIPK_clientId_kid,
        updatedAt: new Date().toISOString(),
      };

      // write the new one
      await upsertTokenGenStatesConsumerClient(
        newEntry,
        dynamoDBClient,
        logger
      );

      if (TokenGenerationStatesClientKidPurposePK.safeParse(entry.PK).success) {
        // Remove only complete entries (to avoid deleting partial entries after retry)
        // delete the old one
        await deleteClientEntryFromTokenGenerationStates(
          entry.PK,
          dynamoDBClient,
          logger
        );
      }
    }

    exclusiveStartKey = lastEvaluatedKey;
  } while (exclusiveStartKey);
};

export const writeTokenGenStatesApiClient = async (
  tokenGenStatesApiClient: TokenGenerationStatesApiClient,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: tokenGenStatesApiClient.PK,
      },
      updatedAt: {
        S: tokenGenStatesApiClient.updatedAt,
      },
      consumerId: {
        S: tokenGenStatesApiClient.consumerId,
      },
      clientKind: {
        S: tokenGenStatesApiClient.clientKind,
      },
      publicKey: {
        S: tokenGenStatesApiClient.publicKey,
      },
      GSIPK_clientId: {
        S: tokenGenStatesApiClient.GSIPK_clientId,
      },
      GSIPK_clientId_kid: {
        S: tokenGenStatesApiClient.GSIPK_clientId_kid,
      },
      ...(tokenGenStatesApiClient.adminId
        ? {
            adminId: {
              S: tokenGenStatesApiClient.adminId,
            },
          }
        : {}),
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(
    `Token-generation-states. Written api client ${tokenGenStatesApiClient.PK}`
  );
};

export const readPlatformCatalogEntry = async (
  primaryKey: PlatformStatesEServiceDescriptorPK,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesCatalogEntry | undefined> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ConsistentRead: true,
  };
  const command = new GetItemCommand(input);
  const data = await dynamoDBClient.send(command);

  if (!data.Item) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Item);
    const catalogEntry = PlatformStatesCatalogEntry.safeParse(unmarshalled);

    if (!catalogEntry.success) {
      throw genericInternalError(
        `Unable to parse platform-states catalog entry: result ${JSON.stringify(
          catalogEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return catalogEntry.data;
  }
};

export const readAgreementEntry = async (
  primaryKey: PlatformStatesAgreementPK,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesAgreementEntry | undefined> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ConsistentRead: true,
  };
  const command = new GetItemCommand(input);
  const data = await dynamoDBClient.send(command);

  if (!data.Item) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Item);
    const agreementEntry = PlatformStatesAgreementEntry.safeParse(unmarshalled);

    if (!agreementEntry.success) {
      throw genericInternalError(
        `Unable to parse platform-states agreement entry: result ${JSON.stringify(
          agreementEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return agreementEntry.data;
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
    ConsistentRead: true,
  };
  const command = new GetItemCommand(input);
  const data = await dynamoDBClient.send(command);

  if (!data.Item) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Item);
    const purposeEntry = PlatformStatesPurposeEntry.safeParse(unmarshalled);

    if (!purposeEntry.success) {
      throw genericInternalError(
        `Unable to parse platform-states purpose entry: result ${JSON.stringify(
          purposeEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return purposeEntry.data;
  }
};

export const upsertTokenGenStatesConsumerClient = async (
  tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  const input: PutItemInput = {
    Item: {
      PK: {
        S: tokenGenStatesConsumerClient.PK,
      },
      ...(tokenGenStatesConsumerClient.descriptorState
        ? {
            descriptorState: {
              S: tokenGenStatesConsumerClient.descriptorState,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.descriptorAudience
        ? {
            descriptorAudience: {
              L: tokenGenStatesConsumerClient.descriptorAudience.map(
                (item) => ({
                  S: item,
                })
              ),
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.descriptorVoucherLifespan
        ? {
            descriptorVoucherLifespan: {
              N: tokenGenStatesConsumerClient.descriptorVoucherLifespan.toString(),
            },
          }
        : {}),
      updatedAt: {
        S: tokenGenStatesConsumerClient.updatedAt,
      },
      ...(tokenGenStatesConsumerClient.producerId
        ? {
            producerId: {
              S: tokenGenStatesConsumerClient.producerId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.consumerId
        ? {
            consumerId: {
              S: tokenGenStatesConsumerClient.consumerId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.agreementId
        ? {
            agreementId: {
              S: tokenGenStatesConsumerClient.agreementId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.purposeVersionId
        ? {
            purposeVersionId: {
              S: tokenGenStatesConsumerClient.purposeVersionId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.GSIPK_consumerId_eserviceId
        ? {
            GSIPK_consumerId_eserviceId: {
              S: tokenGenStatesConsumerClient.GSIPK_consumerId_eserviceId,
            },
          }
        : {}),
      clientKind: {
        S: tokenGenStatesConsumerClient.clientKind,
      },
      publicKey: {
        S: tokenGenStatesConsumerClient.publicKey,
      },
      GSIPK_clientId: {
        S: tokenGenStatesConsumerClient.GSIPK_clientId,
      },
      GSIPK_clientId_kid: {
        S: tokenGenStatesConsumerClient.GSIPK_clientId_kid,
      },
      ...(tokenGenStatesConsumerClient.GSIPK_clientId_purposeId
        ? {
            GSIPK_clientId_purposeId: {
              S: tokenGenStatesConsumerClient.GSIPK_clientId_purposeId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.agreementState
        ? {
            agreementState: {
              S: tokenGenStatesConsumerClient.agreementState,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.GSIPK_eserviceId_descriptorId
        ? {
            GSIPK_eserviceId_descriptorId: {
              S: tokenGenStatesConsumerClient.GSIPK_eserviceId_descriptorId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.GSIPK_purposeId
        ? {
            GSIPK_purposeId: {
              S: tokenGenStatesConsumerClient.GSIPK_purposeId,
            },
          }
        : {}),
      ...(tokenGenStatesConsumerClient.purposeState
        ? {
            purposeState: {
              S: tokenGenStatesConsumerClient.purposeState,
            },
          }
        : {}),
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(
    `Token-generation-states. Upserted consumer client ${tokenGenStatesConsumerClient.PK}`
  );
};

export const clientKindToTokenGenerationStatesClientKind = (
  kind: ClientKind
): ClientKindTokenGenStates =>
  match<ClientKind, ClientKindTokenGenStates>(kind)
    .with(clientKind.consumer, () => clientKindTokenGenStates.consumer)
    .with(clientKind.api, () => clientKindTokenGenStates.api)
    .exhaustive();

export const writePlatformClientEntry = async (
  clientEntry: PlatformStatesClientEntry,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
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
      ...(clientEntry.clientAdminId
        ? {
            clientAdminId: {
              S: clientEntry.clientAdminId,
            },
          }
        : {}),
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(`Platform-states. Written client entry ${clientEntry.PK}`);
};

export const upsertTokenGenStatesConsumerClientsV1 = async ({
  clientId,
  purposeId,
  purposeIds,
  dynamoDBClient,
  logger,
}: {
  clientId: ClientId;
  purposeId: PurposeId;
  purposeIds: PurposeId[];
  dynamoDBClient: DynamoDBClient;
  logger: Logger;
  // eslint-disable-next-line sonarjs/cognitive-complexity
}): Promise<TokenGenerationStatesConsumerClient[]> => {
  // eslint-disable-next-line functional/no-let
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;
  const addedTokenGenStatesConsumerClients =
    new Array<TokenGenerationStatesConsumerClient>();

  do {
    const input: ScanInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      FilterExpression: "contains(#pk, :clientId)",
      ExpressionAttributeNames: {
        "#pk": "PK",
      },
      ExpressionAttributeValues: {
        ":clientId": { S: clientId },
      },
      ConsistentRead: true,
      ExclusiveStartKey: exclusiveStartKey,
    };
    const command = new ScanCommand(input);
    const data = await dynamoDBClient.send(command);

    if (!data.Items) {
      logger.info(
        `Skipping token-generation-states update. Reason: no entries found for client ${clientId}`
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const clientEntries = z
        .array(TokenGenerationStatesGenericClient)
        .safeParse(unmarshalledItems);

      if (!clientEntries.success) {
        throw genericInternalError(
          `Unable to parse token-generation-states entries: result ${JSON.stringify(
            clientEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      const updateTokenGenStatesData = async (): Promise<void> => {
        const { purposeEntry, agreementEntry, catalogEntry } =
          await retrievePlatformStatesByPurpose(
            purposeId,
            dynamoDBClient,
            logger
          );

        const seenKids = new Set<string>();

        for (const entry of clientEntries.data) {
          const addedTokenGenStatesConsumerClient = await match(
            // Count without the current purpose
            purposeIds.length - 1
          )
            .with(0, async () => {
              const newTokenGenStatesConsumerClient =
                createTokenGenStatesConsumerClient({
                  consumerId: entry.consumerId,
                  kid: extractKidFromTokenGenStatesEntryPK(entry.PK),
                  publicKey: entry.publicKey,
                  clientId,
                  purposeId,
                  purposeEntry,
                  agreementEntry,
                  catalogEntry,
                });

              await upsertTokenGenStatesConsumerClient(
                newTokenGenStatesConsumerClient,
                dynamoDBClient,
                logger
              );
              if (
                TokenGenerationStatesClientKidPK.safeParse(entry.PK).success
              ) {
                // Remove only partial entries (to avoid deleting complete entries after retry)
                await deleteClientEntryFromTokenGenerationStates(
                  entry.PK,
                  dynamoDBClient,
                  logger
                );
              }
              return newTokenGenStatesConsumerClient;
            })
            .with(P.number.gt(0), async () => {
              const kid = extractKidFromTokenGenStatesEntryPK(entry.PK);
              if (!seenKids.has(kid)) {
                const newTokenGenStatesConsumerClient =
                  createTokenGenStatesConsumerClient({
                    consumerId: entry.consumerId,
                    kid,
                    publicKey: entry.publicKey,
                    clientId,
                    purposeId,
                    purposeEntry,
                    agreementEntry,
                    catalogEntry,
                  });

                await upsertTokenGenStatesConsumerClient(
                  newTokenGenStatesConsumerClient,
                  dynamoDBClient,
                  logger
                );
                seenKids.add(kid);
                return newTokenGenStatesConsumerClient;
              }
              return null;
            })
            .run();

          if (addedTokenGenStatesConsumerClient) {
            // eslint-disable-next-line functional/immutable-data
            addedTokenGenStatesConsumerClients.push(
              addedTokenGenStatesConsumerClient
            );
          }
        }
      };

      await updateTokenGenStatesData();

      exclusiveStartKey = data.LastEvaluatedKey;
    }
  } while (exclusiveStartKey);

  return addedTokenGenStatesConsumerClients;
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
  dynamoDBClient: DynamoDBClient,
  logger: Logger
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
  logger.info(
    `Platform-states. Updated purpose ids in client entry ${primaryKey}`
  );
};

export const extractKidFromTokenGenStatesEntryPK = (
  pk: TokenGenerationStatesClientKidPK | TokenGenerationStatesClientKidPurposePK
): string => pk.split("#")[2];

export const extractKidFromGSIClientKid = (
  GSIPK_clientId_kid: GSIPKClientIdKid
): string => GSIPK_clientId_kid.split("#")[1];

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

  if (!purposeEntry) {
    return {
      purposeEntry: undefined,
    };
  }

  const agreementPK = makePlatformStatesAgreementPK({
    consumerId: purposeEntry.purposeConsumerId,
    eserviceId: purposeEntry.purposeEserviceId,
  });

  const agreementEntry = await readAgreementEntry(agreementPK, dynamoDBClient);

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
    `Retrieving platform-states catalog entry ${catalogPK} to add descriptor info in token-generation-states`
  );
  const catalogEntry = await readPlatformCatalogEntry(
    catalogPK,
    dynamoDBClient
  );

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
  dynamoDBClient: DynamoDBClient,
  logger: Logger
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
      ...(entry.clientAdminId
        ? {
            clientAdminId: {
              S: entry.clientAdminId,
            },
          }
        : {}),
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(`Platform-states. Upserted client entry ${entry.PK}`);
};

export const upsertTokenGenStatesApiClient = async (
  entry: TokenGenerationStatesApiClient,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
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
      GSIPK_clientId_kid: {
        S: entry.GSIPK_clientId_kid,
      },
      updatedAt: {
        S: entry.updatedAt,
      },
      ...(entry.adminId
        ? {
            adminId: {
              S: entry.adminId,
            },
          }
        : {}),
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(`Token-generation-states. Upserted api client ${entry.PK}`);
};

export const updateTokenGenStatesDataForSecondRetrieval = async ({
  dynamoDBClient,
  entry,
  purposeEntry,
  agreementEntry,
  catalogEntry,
  logger,
}: {
  dynamoDBClient: DynamoDBClient;
  entry: TokenGenerationStatesConsumerClient;
  logger: Logger;
  purposeEntry?: PlatformStatesPurposeEntry;
  agreementEntry?: PlatformStatesAgreementEntry;
  catalogEntry?: PlatformStatesCatalogEntry;
}): Promise<void> => {
  const setIfChanged = <K extends keyof TokenGenerationStatesConsumerClient>(
    key: K,
    newValue: TokenGenerationStatesConsumerClient[K]
  ): Partial<TokenGenerationStatesConsumerClient> => {
    const oldValue = entry[key];

    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      return !oldValue.every((value) => newValue.includes(value))
        ? { [key]: newValue }
        : {};
    }

    return oldValue !== newValue ? { [key]: newValue } : {};
  };
  const updatedFields: Partial<TokenGenerationStatesConsumerClient> = {
    ...(purposeEntry
      ? {
          ...setIfChanged("consumerId", purposeEntry.purposeConsumerId),
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
          ...setIfChanged("producerId", agreementEntry.producerId),
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
    logger.info(`Token-generation-states. Updated entry ${entry.PK}`);
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
  updatedFields: Partial<TokenGenerationStatesConsumerClient>
): Record<string, AttributeValue> => {
  const expressionAttributeValues = Object.keys(updatedFields).reduce(
    (acc, key) => {
      const value = updatedFields[key as keyof typeof updatedFields];
      if (value !== undefined) {
        const dynamoKey = `:${key}`;
        // eslint-disable-next-line local-rules/no-unsafe-object-spread
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
  updatedFields: Partial<TokenGenerationStatesConsumerClient>
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

export const createTokenGenStatesConsumerClient = ({
  consumerId,
  kid,
  publicKey,
  clientId,
  purposeId,
  purposeEntry,
  agreementEntry,
  catalogEntry,
}: {
  consumerId: TenantId | undefined;
  kid: string;
  publicKey: string;
  clientId: ClientId;
  purposeId: PurposeId;
  purposeEntry: PlatformStatesPurposeEntry | undefined;
  agreementEntry: PlatformStatesAgreementEntry | undefined;
  catalogEntry: PlatformStatesCatalogEntry | undefined;
}): TokenGenerationStatesConsumerClient => {
  const pk = makeTokenGenerationStatesClientKidPurposePK({
    clientId,
    kid,
    purposeId,
  });

  return {
    PK: pk,
    updatedAt: new Date().toISOString(),
    clientKind: clientKindTokenGenStates.consumer,
    publicKey,
    GSIPK_clientId: clientId,
    GSIPK_clientId_kid: makeGSIPKClientIdKid({ clientId, kid }),
    GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
      clientId,
      purposeId,
    }),
    GSIPK_purposeId: purposeId,
    ...(purposeEntry &&
      consumerId && {
        consumerId,
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId,
          eserviceId: purposeEntry.purposeEserviceId,
        }),
        purposeState: purposeEntry.state,
        purposeVersionId: purposeEntry.purposeVersionId,
      }),
    ...(purposeEntry &&
      agreementEntry && {
        agreementId: agreementEntry.agreementId,
        agreementState: agreementEntry.state,
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: purposeEntry.purposeEserviceId,
          descriptorId: agreementEntry.agreementDescriptorId,
        }),
        producerId: agreementEntry.producerId,
      }),
    ...(catalogEntry && {
      descriptorState: catalogEntry.state,
      descriptorAudience: catalogEntry.descriptorAudience,
      descriptorVoucherLifespan: catalogEntry.descriptorVoucherLifespan,
    }),
  };
};

export const removeAdminIdFromTokenGenStatesApiClient = async (
  primaryKey: TokenGenerationStatesClientKidPK,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  const input: UpdateItemInput = {
    ConditionExpression: "attribute_exists(PK)",
    Key: {
      PK: {
        S: primaryKey,
      },
    },
    UpdateExpression: "REMOVE adminId",
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(
    `Token-generation-states. Removed adminId from api client ${primaryKey}`
  );
};
