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
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makeGSIPKClientIdKid,
  makePlatformStatesClientPK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  missingKafkaMessageDataError,
  PlatformStatesClientEntry,
  PurposeId,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesConsumerClient,
  unsafeBrandId,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Logger } from "pagopa-interop-commons";
import {
  clientKindToTokenGenerationStatesClientKind,
  convertEntriesToClientKidInTokenGenerationStates,
  createTokenGenStatesConsumerClient,
  deleteClientEntryFromPlatformStates,
  deleteClientEntryFromTokenGenerationStates,
  deleteEntriesFromTokenGenStatesByClientId,
  deleteEntriesFromTokenGenStatesByKid,
  deleteEntriesFromTokenGenStatesByGSIPKClientIdPurposeId,
  extractAgreementIdFromAgreementPK,
  extractKidFromTokenGenStatesEntryPK,
  readConsumerClientEntriesInTokenGenerationStates,
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
        await upsertPlatformClientEntry(updatedClientEntry, dynamoDBClient);
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
        };
        await upsertPlatformClientEntry(platformClientEntry, dynamoDBClient);

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

                  const tokenClientKidPurposePK =
                    makeTokenGenerationStatesClientKidPurposePK({
                      clientId,
                      kid,
                      purposeId,
                    });

                  const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
                    {
                      PK: tokenClientKidPurposePK,
                      consumerId: platformClientEntry.clientConsumerId,
                      clientKind: clientKindTokenGenStates.consumer,
                      publicKey: pem,
                      updatedAt: new Date().toISOString(),
                      GSIPK_clientId: clientId,
                      GSIPK_clientId_kid: makeGSIPKClientIdKid(kid),
                      GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
                        clientId,
                        purposeId,
                      }),
                      GSIPK_purposeId: purposeId,
                      ...(purposeEntry
                        ? {
                            GSIPK_consumerId_eserviceId:
                              makeGSIPKConsumerIdEServiceId({
                                consumerId:
                                  platformClientEntry.clientConsumerId,
                                eserviceId: purposeEntry.purposeEserviceId,
                              }),
                            purposeState: purposeEntry.state,
                            purposeVersionId: purposeEntry.purposeVersionId,
                          }
                        : {}),
                      ...(purposeEntry && agreementEntry
                        ? {
                            agreementId: extractAgreementIdFromAgreementPK(
                              agreementEntry.PK
                            ),
                            agreementState: agreementEntry.state,
                            GSIPK_eserviceId_descriptorId:
                              makeGSIPKEServiceIdDescriptorId({
                                eserviceId: purposeEntry.purposeEserviceId,
                                descriptorId:
                                  agreementEntry.agreementDescriptorId,
                              }),
                          }
                        : {}),
                      ...(catalogEntry
                        ? {
                            descriptorState: catalogEntry.state,
                            descriptorAudience: catalogEntry.descriptorAudience,
                            descriptorVoucherLifespan:
                              catalogEntry.descriptorVoucherLifespan,
                          }
                        : {}),
                    };
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
                  GSIPK_clientId_kid: makeGSIPKClientIdKid(kid),
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
              consumerId: platformClientEntry.clientConsumerId,
              clientKind: clientKindTokenGenStates.api,
              publicKey: pem,
              GSIPK_clientId: clientId,
              GSIPK_clientId_kid: makeGSIPKClientIdKid(kid),
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
        await upsertPlatformClientEntry(platformClientEntry, dynamoDBClient);

        const GSIPK_clientId_kid = makeGSIPKClientIdKid(msg.data.keyId);
        await deleteEntriesFromTokenGenStatesByKid(
          GSIPK_clientId_kid,
          dynamoDBClient,
          logger
        );
      }
    })
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
        return Promise.resolve();
      } else {
        const purposeIds = [...clientEntry.clientPurposesIds, purposeId];
        await setClientPurposeIdsInPlatformStatesEntry(
          {
            primaryKey: pk,
            version: msg.version,
            clientPurposeIds: purposeIds,
          },
          dynamoDBClient
        );

        const GSIPK_clientId = clientId;
        const tokenGenStatesConsumerClients =
          await readConsumerClientEntriesInTokenGenerationStates(
            GSIPK_clientId,
            dynamoDBClient
          );
        if (tokenGenStatesConsumerClients.length === 0) {
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
              clientEntry.clientPurposesIds.length
            )
              .with(0, async () => {
                const newTokenGenStatesConsumerClient =
                  createTokenGenStatesConsumerClient({
                    tokenGenStatesClient: entry,
                    kid: extractKidFromTokenGenStatesEntryPK(entry.PK),
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
                await deleteClientEntryFromTokenGenerationStates(
                  entry.PK,
                  dynamoDBClient,
                  logger
                );
                return newTokenGenStatesConsumerClient;
              })
              .with(P.number.gt(0), async () => {
                const kid = extractKidFromTokenGenStatesEntryPK(entry.PK);
                if (!seenKids.has(kid)) {
                  const newTokenGenStatesConsumerClient =
                    createTokenGenStatesConsumerClient({
                      tokenGenStatesClient: entry,
                      kid,
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
      }
    })
    .with({ type: "ClientPurposeRemoved" }, async (msg) => {
      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);
      const purposeIdToRemove = unsafeBrandId<PurposeId>(msg.data.purposeId);

      const pk = makePlatformStatesClientPK(clientId);
      const clientEntry = await readPlatformClientEntry(pk, dynamoDBClient);

      if (clientEntry) {
        if (clientEntry.version > msg.version) {
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
            dynamoDBClient
          );

          // token-generation-states
          if (updatedPurposeIds.length > 0) {
            await deleteEntriesFromTokenGenStatesByGSIPKClientIdPurposeId(
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
      }
    })
    .with({ type: "ClientDeleted" }, async (msg) => {
      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);
      const pk = makePlatformStatesClientPK(clientId);
      await deleteClientEntryFromPlatformStates(pk, dynamoDBClient);

      const GSIPK_clientId = clientId;
      await deleteEntriesFromTokenGenStatesByClientId(
        GSIPK_clientId,
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
