import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  AuthorizationEventEnvelopeV2,
  Client,
  clientKind,
  clientKindTokenGenStates,
  ClientV2,
  fromClientV2,
  itemState,
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
import { match, P } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import {
  clientKindToTokenGenerationStatesClientKind,
  convertEntriesToClientKidInTokenGenerationStates,
  deleteClientEntryFromPlatformStates,
  deleteEntriesFromTokenGenStatesByClientId,
  deleteEntriesFromTokenGenStatesByKid,
  deleteEntriesFromTokenGenStatesByGSIPKClientIdPurposeId,
  readPlatformClientEntry,
  deleteClientEntryFromTokenGenerationStates,
  extractKidFromTokenGenStatesEntryPK,
  extractAgreementIdFromAgreementPK,
  retrievePlatformStatesByPurpose,
  upsertPlatformClientEntry,
  upsertTokenGenStatesApiClient,
  upsertTokenGenStatesConsumerClient,
  setClientPurposeIdsInPlatformStatesEntry,
  updateTokenGenStatesDataForSecondRetrieval,
  createTokenGenStatesConsumerClient,
  readConsumerClientEntriesInTokenGenerationStates,
} from "./utils.js";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> {
  await match(message)
    // eslint-disable-next-line sonarjs/cognitive-complexity
    .with({ type: "ClientKeyAdded" }, async (msg) => {
      const client = parseClient(msg.data.client, msg.type);

      const pem = client.keys.find(
        (key) => key.kid === msg.data.kid
      )?.encodedPem;
      if (!pem) {
        throw missingKafkaMessageDataError("key", msg.type);
      }

      const platformClientPK = makePlatformStatesClientPK(client.id);
      const clientEntry = await readPlatformClientEntry(
        platformClientPK,
        dynamoDBClient
      );

      if (clientEntry && clientEntry.version > msg.version) {
        return Promise.resolve();
      } else {
        // platform-states
        const platformClientEntry: PlatformStatesClientEntry = {
          PK: platformClientPK,
          state: itemState.active,
          clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
          clientConsumerId: client.consumerId,
          clientPurposesIds: [],
          version: msg.version,
          updatedAt: new Date().toISOString(),
        };
        await upsertPlatformClientEntry(platformClientEntry, dynamoDBClient);
      }

      // token-generation-states
      await match(client.kind)
        .with(clientKind.consumer, async () => {
          if (client.purposes.length > 0) {
            const addedEntries = await Promise.all(
              client.purposes.map(async (purposeId) => {
                const { purposeEntry, agreementEntry, catalogEntry } =
                  await retrievePlatformStatesByPurpose(
                    purposeId,
                    dynamoDBClient,
                    logger
                  );

                const tokenClientKidPurposePK =
                  makeTokenGenerationStatesClientKidPurposePK({
                    clientId: client.id,
                    kid: msg.data.kid,
                    purposeId,
                  });

                const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
                  {
                    PK: tokenClientKidPurposePK,
                    consumerId: client.consumerId,
                    clientKind: clientKindTokenGenStates.consumer,
                    publicKey: pem,
                    updatedAt: new Date().toISOString(),
                    GSIPK_clientId: client.id,
                    GSIPK_clientId_kid: makeGSIPKClientIdKid(msg.data.kid),
                    GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
                      clientId: client.id,
                      purposeId,
                    }),
                    GSIPK_purposeId: purposeId,
                    ...(purposeEntry
                      ? {
                          GSIPK_consumerId_eserviceId:
                            makeGSIPKConsumerIdEServiceId({
                              consumerId: client.consumerId,
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
              client.purposes.map(async (purposeId, index) => {
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
                  clientId: client.id,
                  kid: msg.data.kid,
                }),
                consumerId: client.consumerId,
                clientKind: clientKindTokenGenStates.consumer,
                publicKey: pem,
                GSIPK_clientId: client.id,
                GSIPK_clientId_kid: makeGSIPKClientIdKid(msg.data.kid),
                updatedAt: new Date().toISOString(),
              };
            await upsertTokenGenStatesConsumerClient(
              tokenGenStatesConsumerClientWithoutPurpose,
              dynamoDBClient,
              logger
            );
          }
        })
        .with(clientKind.api, async () => {
          const tokenGenStatesApiClient: TokenGenerationStatesApiClient = {
            PK: makeTokenGenerationStatesClientKidPK({
              clientId: client.id,
              kid: msg.data.kid,
            }),
            consumerId: client.consumerId,
            clientKind: clientKindTokenGenStates.api,
            publicKey: pem,
            GSIPK_clientId: client.id,
            GSIPK_clientId_kid: makeGSIPKClientIdKid(msg.data.kid),
            updatedAt: new Date().toISOString(),
          };
          await upsertTokenGenStatesApiClient(
            tokenGenStatesApiClient,
            dynamoDBClient,
            logger
          );
        })
        .exhaustive();
    })
    .with({ type: "ClientKeyDeleted" }, async (msg) => {
      const client = parseClient(msg.data.client, msg.type);
      const pk = makePlatformStatesClientPK(client.id);
      const clientEntry = await readPlatformClientEntry(pk, dynamoDBClient);

      if (clientEntry && clientEntry.version > msg.version) {
        return Promise.resolve();
      } else {
        const platformClientEntry: PlatformStatesClientEntry = {
          PK: pk,
          state: itemState.active,
          clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
          clientConsumerId: client.consumerId,
          clientPurposesIds: [],
          version: msg.version,
          updatedAt: new Date().toISOString(),
        };
        await upsertPlatformClientEntry(platformClientEntry, dynamoDBClient);
      }

      const GSIPK_clientId_kid = makeGSIPKClientIdKid(msg.data.kid);
      await deleteEntriesFromTokenGenStatesByKid(
        GSIPK_clientId_kid,
        dynamoDBClient,
        logger
      );
    })
    .with({ type: "ClientPurposeAdded" }, async (msg) => {
      const client = parseClient(msg.data.client, msg.type);

      // platform-states
      const platformClientEntryPK = makePlatformStatesClientPK(client.id);
      const clientEntry = await readPlatformClientEntry(
        platformClientEntryPK,
        dynamoDBClient
      );
      if (clientEntry && clientEntry.version > msg.version) {
        return Promise.resolve();
      } else {
        // platform-states
        const platformClientEntry: PlatformStatesClientEntry = {
          PK: platformClientEntryPK,
          state: itemState.active,
          clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
          clientConsumerId: client.consumerId,
          clientPurposesIds: [],
          version: msg.version,
          updatedAt: new Date().toISOString(),
        };
        await upsertPlatformClientEntry(platformClientEntry, dynamoDBClient);
      }

      // token-generation-states
      const GSIPK_clientId = client.id;
      const tokenGenStatesConsumerClients =
        await readConsumerClientEntriesInTokenGenerationStates(
          GSIPK_clientId,
          dynamoDBClient
        );
      if (tokenGenStatesConsumerClients.length === 0) {
        return Promise.resolve();
      } else {
        const purposeId = unsafeBrandId<PurposeId>(msg.data.purposeId);
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
            client.purposes.length
          )
            .with(1, async () => {
              const newTokenGenStatesConsumerClient =
                createTokenGenStatesConsumerClient({
                  tokenGenStatesClient: entry,
                  kid: extractKidFromTokenGenStatesEntryPK(entry.PK),
                  clientId: client.id,
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
            .with(P.number.gt(1), async () => {
              const kid = extractKidFromTokenGenStatesEntryPK(entry.PK);
              if (!seenKids.has(kid)) {
                const newTokenGenStatesConsumerClient =
                  createTokenGenStatesConsumerClient({
                    tokenGenStatesClient: entry,
                    kid,
                    clientId: client.id,
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
      const client = parseClient(msg.data.client, msg.type);
      const pk = makePlatformStatesClientPK(client.id);
      const clientEntry = await readPlatformClientEntry(pk, dynamoDBClient);

      if (clientEntry) {
        if (clientEntry.version > msg.version) {
          return Promise.resolve();
        } else {
          const GSIPK_clientId_purposeId = makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: unsafeBrandId(msg.data.purposeId),
          });

          // platform-states
          await setClientPurposeIdsInPlatformStatesEntry(
            { primaryKey: pk, version: msg.version, clientPurposeIds: [] },
            dynamoDBClient
          );

          // token-generation-states
          if (client.purposes.length > 0) {
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
      const client = parseClient(msg.data.client, msg.type);
      const pk = makePlatformStatesClientPK(client.id);
      await deleteClientEntryFromPlatformStates(pk, dynamoDBClient);

      const GSIPK_clientId = client.id;
      await deleteEntriesFromTokenGenStatesByClientId(
        GSIPK_clientId,
        dynamoDBClient,
        logger
      );
    })
    .with(
      { type: "ClientAdded" },
      { type: "ClientUserAdded" },
      { type: "ClientUserDeleted" },
      { type: "ProducerKeychainAdded" },
      { type: "ProducerKeychainDeleted" },
      { type: "ProducerKeychainEServiceAdded" },
      { type: "ProducerKeychainEServiceRemoved" },
      { type: "ProducerKeychainEServiceAdded" },
      { type: "ProducerKeychainEServiceRemoved" },
      { type: "ProducerKeychainKeyAdded" },
      { type: "ProducerKeychainKeyDeleted" },
      { type: "ProducerKeychainUserAdded" },
      { type: "ProducerKeychainUserDeleted" },
      () => Promise.resolve()
    )
    .exhaustive();
}

const parseClient = (
  clientV2: ClientV2 | undefined,
  eventType: string
): Client => {
  if (!clientV2) {
    throw missingKafkaMessageDataError("client", eventType);
  }

  return fromClientV2(clientV2);
};
