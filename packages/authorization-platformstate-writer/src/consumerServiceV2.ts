import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  AuthorizationEventEnvelopeV2,
  Client,
  clientKind,
  clientKindTokenGenStates,
  ClientV2,
  fromClientV2,
  itemState,
  makeGSIPKClientIdKid,
  makePlatformStatesClientPK,
  makeTokenGenerationStatesClientKidPK,
  missingKafkaMessageDataError,
  PlatformStatesClientEntry,
  PurposeId,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesConsumerClient,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import {
  clientKindToTokenGenerationStatesClientKind,
  deleteClientEntryFromPlatformStates,
  readPlatformClientEntry,
  deleteClientEntryFromTokenGenerationStates,
  retrievePlatformStatesByPurpose,
  upsertPlatformClientEntry,
  upsertTokenGenStatesApiClient,
  upsertTokenGenStatesConsumerClient,
  setClientPurposeIdsInPlatformStatesEntry,
  updateTokenGenStatesDataForSecondRetrieval,
  createTokenGenStatesConsumerClient,
  deleteEntriesFromTokenGenStatesByClientIdV2,
  deleteEntriesFromTokenGenStatesByClientIdPurposeIdV2,
  deleteEntriesFromTokenGenStatesByClientIdKidV2,
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
        logger.info(
          `Skipping processing of entry ${clientEntry.PK}. Reason: a more recent entry already exists`
        );
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
        await upsertPlatformClientEntry(
          platformClientEntry,
          dynamoDBClient,
          logger
        );
      }

      // token-generation-states
      await match(client.kind)
        .with(clientKind.consumer, async () => {
          if (client.purposes.length === 0) {
            logger.info(
              "Token-generation-states. No entry to add because the client doesn't have any purposes yet"
            );
            return Promise.resolve();
          }

          const addedEntries = await Promise.all(
            client.purposes.map(async (purposeId) => {
              const { purposeEntry, agreementEntry, catalogEntry } =
                await retrievePlatformStatesByPurpose(
                  purposeId,
                  dynamoDBClient,
                  logger
                );

              const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
                createTokenGenStatesConsumerClient({
                  consumerId: purposeEntry?.purposeConsumerId,
                  kid: msg.data.kid,
                  publicKey: pem,
                  clientId: client.id,
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
            GSIPK_clientId_kid: makeGSIPKClientIdKid({
              clientId: client.id,
              kid: msg.data.kid,
            }),
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
        logger.info(
          `Skipping processing of entry ${clientEntry.PK}. Reason: a more recent entry already exists`
        );
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
        await upsertPlatformClientEntry(
          platformClientEntry,
          dynamoDBClient,
          logger
        );
      }

      await deleteEntriesFromTokenGenStatesByClientIdKidV2(
        client,
        msg.data.kid,
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
        logger.info(
          `Skipping processing of entry ${clientEntry.PK}. Reason: a more recent entry already exists`
        );
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
        await upsertPlatformClientEntry(
          platformClientEntry,
          dynamoDBClient,
          logger
        );
      }

      // token-generation-states
      if (client.keys.length === 0) {
        logger.info(
          `Skipping token-generation-states update. Reason: client ${client.id} has zero keys`
        );
        return Promise.resolve();
      } else {
        const purposeId = unsafeBrandId<PurposeId>(msg.data.purposeId);
        const { purposeEntry, agreementEntry, catalogEntry } =
          await retrievePlatformStatesByPurpose(
            purposeId,
            dynamoDBClient,
            logger
          );

        const addedTokenGenStatesConsumerClients: TokenGenerationStatesConsumerClient[] =
          await Promise.all(
            client.keys.map(async (key) => {
              const newTokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
                createTokenGenStatesConsumerClient({
                  consumerId: purposeEntry?.purposeConsumerId,
                  kid: key.kid,
                  publicKey: key.encodedPem,
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
                makeTokenGenerationStatesClientKidPK({
                  clientId: client.id,
                  kid: key.kid,
                }),
                dynamoDBClient,
                logger
              );

              return newTokenGenStatesConsumerClient;
            })
          );

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
          logger.info(
            `Skipping processing of entry ${clientEntry.PK}. Reason: a more recent entry already exists`
          );
          return Promise.resolve();
        } else {
          const purposeId = unsafeBrandId<PurposeId>(msg.data.purposeId);

          // platform-states
          await setClientPurposeIdsInPlatformStatesEntry(
            { primaryKey: pk, version: msg.version, clientPurposeIds: [] },
            dynamoDBClient,
            logger
          );

          // token-generation-states
          await deleteEntriesFromTokenGenStatesByClientIdPurposeIdV2(
            client,
            purposeId,
            dynamoDBClient,
            logger
          );
        }
      } else {
        logger.info(
          `Platform-states and token-generation-states. Skipping processing of entry ${pk}. Reason: entry not found in platform-states`
        );
      }
    })
    .with({ type: "ClientDeleted" }, async (msg) => {
      const client = parseClient(msg.data.client, msg.type);
      const pk = makePlatformStatesClientPK(client.id);
      await deleteClientEntryFromPlatformStates(pk, dynamoDBClient, logger);

      await deleteEntriesFromTokenGenStatesByClientIdV2(
        client,
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
