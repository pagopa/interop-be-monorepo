import { match, P } from "ts-pattern";
import {
  AuthorizationEventEnvelopeV1,
  Client,
  ClientId,
  clientKindTokenGenStates,
  ClientV1,
  fromClientV1,
  fromKeyV1,
  itemState,
  Key,
  KeyV1,
  makeGSIPKClientIdPurposeId,
  makeGSIPKClientIdKid,
  makePlatformStatesClientPK,
  makeTokenGenerationStatesClientKidPK,
  missingKafkaMessageDataError,
  PlatformStatesClientEntry,
  PurposeId,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesConsumerClient,
  unsafeBrandId,
  TokenGenerationStatesClientKidPK,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Logger } from "pagopa-interop-commons";
import {
  clientKindToTokenGenerationStatesClientKind,
  convertEntriesToClientKidInTokenGenerationStates,
  createTokenGenStatesConsumerClient,
  deleteClientEntryFromPlatformStates,
  deleteClientEntryFromTokenGenerationStates,
  deleteEntriesFromTokenGenStatesByClientIdKidV1,
  deleteEntriesFromTokenGenStatesByClientIdV1,
  deleteEntriesFromTokenGenStatesByClientIdPurposeIdV1,
  extractKidFromTokenGenStatesEntryPK,
  readConsumerClientsInTokenGenStatesV1,
  readPlatformClientEntry,
  retrievePlatformStatesByPurpose,
  setClientPurposeIdsInPlatformStatesEntry,
  updateTokenGenStatesDataForSecondRetrieval,
  upsertPlatformClientEntry,
  upsertTokenGenStatesApiClient,
  upsertTokenGenStatesConsumerClient,
} from "./utils.js";

export async function handleMessageV1(
  message: AuthorizationEventEnvelopeV1,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> {
  await match(message)
    .with({ type: "ClientAdded" }, async (msg) => {
      const client = parseClient(msg.data.client, msg.type);

      const pk = makePlatformStatesClientPK(client.id);
      const clientEntry = await readPlatformClientEntry(pk, dynamoDBClient);

      if (clientEntry && clientEntry.version > msg.version) {
        logger.info(
          `Skipping processing of entry ${clientEntry.PK}. Reason: a more recent entry already exists`
        );
        return Promise.resolve();
      } else {
        const updatedClientEntry: PlatformStatesClientEntry = {
          PK: pk,
          version: msg.version,
          state: itemState.active,
          clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
          clientConsumerId: client.consumerId,
          updatedAt: new Date().toISOString(),
          clientPurposesIds: client.purposes,
        };
        await upsertPlatformClientEntry(
          updatedClientEntry,
          dynamoDBClient,
          logger
        );
      }
    })
    // eslint-disable-next-line sonarjs/cognitive-complexity
    .with({ type: "KeysAdded" }, async (msg) => {
      const keyV1 = msg.data.keys[0].value;

      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);
      const key = parseKey(keyV1, msg.type);
      const kid = key.kid;
      const pem = key.encodedPem;

      const pk = makePlatformStatesClientPK(clientId);
      const clientEntry = await readPlatformClientEntry(pk, dynamoDBClient);

      if (!clientEntry || clientEntry.version > msg.version) {
        logger.info(
          `Skipping processing of entry ${pk}. Reason: ${
            !clientEntry
              ? "entry not found in platform-states"
              : "a more recent entry already exists"
          }`
        );
        return Promise.resolve();
      } else {
        const clientPurposesIds = clientEntry?.clientPurposesIds || [];

        const platformClientEntry: PlatformStatesClientEntry = {
          PK: pk,
          state: itemState.active,
          clientKind: clientEntry.clientKind,
          clientConsumerId: clientEntry.clientConsumerId,
          clientPurposesIds,
          version: msg.version,
          updatedAt: new Date().toISOString(),
          adminId: clientEntry.adminId,
        };
        await upsertPlatformClientEntry(
          platformClientEntry,
          dynamoDBClient,
          logger
        );

        await match(clientEntry.clientKind)
          .with(clientKindTokenGenStates.consumer, async () => {
            if (clientPurposesIds.length > 0) {
              const addedEntries = await Promise.all(
                clientPurposesIds.map(async (purposeId) => {
                  const { purposeEntry, agreementEntry, catalogEntry } =
                    await retrievePlatformStatesByPurpose(
                      purposeId,
                      dynamoDBClient,
                      logger
                    );

                  const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
                    createTokenGenStatesConsumerClient({
                      consumerId: clientEntry.clientConsumerId,
                      kid,
                      publicKey: pem,
                      clientId,
                      purposeId,
                      purposeEntry,
                      agreementEntry,
                      catalogEntry,
                    });

                  await upsertTokenGenStatesConsumerClient(
                    tokenGenStatesConsumerClient,
                    dynamoDBClient,
                    logger
                  );
                  return tokenGenStatesConsumerClient;
                })
              );

              // Second check for updated fields
              await Promise.all(
                clientPurposesIds.map(async (purposeId, index) => {
                  const {
                    purposeEntry: purposeEntry2,
                    agreementEntry: agreementEntry2,
                    catalogEntry: catalogEntry2,
                  } = await retrievePlatformStatesByPurpose(
                    purposeId,
                    dynamoDBClient,
                    logger
                  );

                  const addedTokenGenStatesConsumerClient = addedEntries[index];
                  await updateTokenGenStatesDataForSecondRetrieval({
                    dynamoDBClient,
                    entry: addedTokenGenStatesConsumerClient,
                    purposeEntry: purposeEntry2,
                    agreementEntry: agreementEntry2,
                    catalogEntry: catalogEntry2,
                    logger,
                  });
                })
              );
            } else {
              const tokenGenStatesConsumerClientWithoutPurpose: TokenGenerationStatesConsumerClient =
                {
                  PK: makeTokenGenerationStatesClientKidPK({
                    clientId,
                    kid,
                  }),
                  consumerId: platformClientEntry.clientConsumerId,
                  clientKind: clientKindTokenGenStates.consumer,
                  publicKey: pem,
                  GSIPK_clientId: clientId,
                  GSIPK_clientId_kid: makeGSIPKClientIdKid({ clientId, kid }),
                  updatedAt: new Date().toISOString(),
                };
              await upsertTokenGenStatesConsumerClient(
                tokenGenStatesConsumerClientWithoutPurpose,
                dynamoDBClient,
                logger
              );
            }
          })
          .with(clientKindTokenGenStates.api, async () => {
            const tokenGenStatesApiClient: TokenGenerationStatesApiClient = {
              PK: makeTokenGenerationStatesClientKidPK({
                clientId,
                kid,
              }),
              adminId: platformClientEntry.adminId,
              consumerId: platformClientEntry.clientConsumerId,
              clientKind: clientKindTokenGenStates.api,
              publicKey: pem,
              GSIPK_clientId: clientId,
              GSIPK_clientId_kid: makeGSIPKClientIdKid({ clientId, kid }),
              updatedAt: new Date().toISOString(),
            };
            await upsertTokenGenStatesApiClient(
              tokenGenStatesApiClient,
              dynamoDBClient,
              logger
            );
          })
          .exhaustive();
      }
    })
    .with({ type: "KeyDeleted" }, async (msg) => {
      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);
      const pk = makePlatformStatesClientPK(clientId);
      const clientEntry = await readPlatformClientEntry(pk, dynamoDBClient);

      if (!clientEntry || clientEntry.version > msg.version) {
        logger.info(
          `Skipping processing of entry ${pk}. Reason: ${
            !clientEntry
              ? "entry not found in platform-states"
              : "a more recent entry already exists"
          }`
        );
        return Promise.resolve();
      } else {
        const platformClientEntry: PlatformStatesClientEntry = {
          PK: pk,
          state: itemState.active,
          clientKind: clientEntry.clientKind,
          clientConsumerId: clientEntry.clientConsumerId,
          clientPurposesIds: clientEntry.clientPurposesIds,
          version: msg.version,
          updatedAt: new Date().toISOString(),
        };
        await upsertPlatformClientEntry(
          platformClientEntry,
          dynamoDBClient,
          logger
        );

        await deleteEntriesFromTokenGenStatesByClientIdKidV1(
          clientId,
          msg.data.keyId,
          dynamoDBClient,
          logger
        );
      }
    })
    // eslint-disable-next-line sonarjs/cognitive-complexity
    .with({ type: "ClientPurposeAdded" }, async (msg) => {
      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);

      const unparsedPurposeId = msg.data.statesChain?.purpose?.purposeId;

      if (!unparsedPurposeId) {
        throw missingKafkaMessageDataError("purposeId", msg.type);
      }
      const purposeId = unsafeBrandId<PurposeId>(unparsedPurposeId);

      const pk = makePlatformStatesClientPK(clientId);
      const clientEntry = await readPlatformClientEntry(pk, dynamoDBClient);
      if (!clientEntry || clientEntry.version > msg.version) {
        logger.info(
          `Skipping processing of entry ${pk}. Reason: ${
            !clientEntry
              ? "entry not found in platform-states"
              : "a more recent entry already exists"
          }`
        );
        return Promise.resolve();
      }

      // Deduplicate in case of retry and reprocess
      const purposeIds = Array.from(
        new Set([...clientEntry.clientPurposesIds, purposeId])
      );
      await setClientPurposeIdsInPlatformStatesEntry(
        {
          primaryKey: pk,
          version: msg.version,
          clientPurposeIds: purposeIds,
        },
        dynamoDBClient,
        logger
      );

      const tokenGenStatesConsumerClients =
        await readConsumerClientsInTokenGenStatesV1(clientId, dynamoDBClient);
      if (tokenGenStatesConsumerClients.length === 0) {
        logger.info(
          `Skipping token-generation-states update. Reason: no entries found for client ${clientId}`
        );
        return Promise.resolve();
      } else {
        const { purposeEntry, agreementEntry, catalogEntry } =
          await retrievePlatformStatesByPurpose(
            purposeId,
            dynamoDBClient,
            logger
          );

        const seenKids = new Set<string>();
        const addedTokenGenStatesConsumerClients: TokenGenerationStatesConsumerClient[] =
          [];

        for (const entry of tokenGenStatesConsumerClients) {
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

        // Second check for updated fields
        await Promise.all(
          addedTokenGenStatesConsumerClients.map(async (entry) => {
            const {
              purposeEntry: purposeEntry2,
              agreementEntry: agreementEntry2,
              catalogEntry: catalogEntry2,
            } = await retrievePlatformStatesByPurpose(
              purposeId,
              dynamoDBClient,
              logger
            );

            await updateTokenGenStatesDataForSecondRetrieval({
              dynamoDBClient,
              entry,
              purposeEntry: purposeEntry2,
              agreementEntry: agreementEntry2,
              catalogEntry: catalogEntry2,
              logger,
            });
          })
        );
      }
    })
    .with({ type: "ClientPurposeRemoved" }, async (msg) => {
      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);
      const purposeIdToRemove = unsafeBrandId<PurposeId>(msg.data.purposeId);

      const pk = makePlatformStatesClientPK(clientId);
      const clientEntry = await readPlatformClientEntry(pk, dynamoDBClient);

      if (clientEntry) {
        if (clientEntry.version > msg.version) {
          logger.info(
            `Skipping processing of entry ${pk}. Reason: a more recent entry already exists`
          );
          return Promise.resolve();
        } else {
          const updatedPurposeIds = clientEntry.clientPurposesIds.filter(
            (purposeId) => purposeId !== purposeIdToRemove
          );
          const GSIPK_clientId_purposeId = makeGSIPKClientIdPurposeId({
            clientId,
            purposeId: unsafeBrandId(msg.data.purposeId),
          });

          // platform-states
          await setClientPurposeIdsInPlatformStatesEntry(
            {
              primaryKey: pk,
              version: msg.version,
              clientPurposeIds: updatedPurposeIds,
            },
            dynamoDBClient,
            logger
          );

          // token-generation-states
          if (updatedPurposeIds.length > 0) {
            await deleteEntriesFromTokenGenStatesByClientIdPurposeIdV1(
              GSIPK_clientId_purposeId,
              dynamoDBClient,
              logger
            );
          } else {
            await convertEntriesToClientKidInTokenGenerationStates(
              GSIPK_clientId_purposeId,
              dynamoDBClient,
              logger
            );
          }
        }
      } else {
        logger.info(
          `Platform-states and token-generation-states. Skipping processing of entry ${pk}. Reason: not found in platform-states`
        );
      }
    })
    .with({ type: "ClientDeleted" }, async (msg) => {
      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);
      const pk = makePlatformStatesClientPK(clientId);
      await deleteClientEntryFromPlatformStates(pk, dynamoDBClient, logger);

      await deleteEntriesFromTokenGenStatesByClientIdV1(
        clientId,
        dynamoDBClient,
        logger
      );
    })
    .with(
      { type: "KeyRelationshipToUserMigrated" },
      { type: "RelationshipAdded" },
      { type: "RelationshipAdded" },
      { type: "RelationshipRemoved" },
      { type: "UserAdded" },
      { type: "UserRemoved" },
      async () => Promise.resolve()
    )
    .exhaustive();
}

export const parseKey = (keyV1: KeyV1 | undefined, eventType: string): Key => {
  if (!keyV1) {
    throw missingKafkaMessageDataError("key", eventType);
  }

  return fromKeyV1(keyV1);
};

const parseClient = (
  clientV1: ClientV1 | undefined,
  eventType: string
): Client => {
  if (!clientV1) {
    throw missingKafkaMessageDataError("client", eventType);
  }

  return fromClientV1(clientV1);
};
