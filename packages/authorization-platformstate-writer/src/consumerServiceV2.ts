import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  AuthorizationEventEnvelopeV2,
  Client,
  ClientV2,
  fromClientV2,
  genericInternalError,
  itemState,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makeGSIPKKid,
  makePlatformStatesClientPK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  missingKafkaMessageDataError,
  PlatformStatesClientEntry,
  PurposeId,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import {
  clientKindToTokenGenerationStatesClientKind,
  convertEntriesToClientKidInTokenGenerationStates,
  deleteClientEntryFromPlatformStates,
  deleteEntriesFromTokenStatesByClient,
  deleteEntriesFromTokenStatesByKid,
  deleteEntriesWithClientAndPurposeFromTokenGenerationStatesTable,
  readClientEntry,
  readClientEntriesInTokenGenerationStates,
  deleteClientEntryFromTokenGenerationStatesTable,
  extractKidFromTokenEntryPK,
  extractAgreementIdFromAgreementPK,
  retrievePlatformStatesByPurpose,
  upsertPlatformClientEntry,
  upsertTokenClientKidEntry,
  upsertTokenStateClientPurposeEntry,
  setClientPurposeIdsInPlatformStatesEntry,
  updateTokenDataForSecondRetrieval,
  createTokenClientPurposeEntry,
} from "./utils.js";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> {
  await match(message)
    .with({ type: "ClientKeyAdded" }, async (msg) => {
      const client = parseClient(msg.data.client, msg.type);

      const pem = client.keys.find(
        (key) => key.kid === msg.data.kid
      )?.encodedPem;
      if (!pem) {
        throw missingKafkaMessageDataError("key", msg.type);
      }

      const platformClientPK = makePlatformStatesClientPK(client.id);
      const clientEntry = await readClientEntry(
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

            const clientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
              {
                PK: tokenClientKidPurposePK,
                consumerId: client.consumerId,
                clientKind: clientKindToTokenGenerationStatesClientKind(
                  client.kind
                ),
                publicKey: pem,
                updatedAt: new Date().toISOString(),
                GSIPK_clientId: client.id,
                GSIPK_kid: makeGSIPKKid(msg.data.kid),
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
                          descriptorId: agreementEntry.agreementDescriptorId,
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

            await upsertTokenStateClientPurposeEntry(
              clientKidPurposeEntry,
              dynamoDBClient
            );
            return clientKidPurposeEntry;
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

            const addedClientKidPurposeEntry = addedEntries[index];
            await updateTokenDataForSecondRetrieval({
              dynamoDBClient,
              entry: addedClientKidPurposeEntry,
              purposeEntry: purposeEntry2,
              agreementEntry: agreementEntry2,
              catalogEntry: catalogEntry2,
            });
          })
        );
      } else {
        const clientKidEntry: TokenGenerationStatesClientEntry = {
          PK: makeTokenGenerationStatesClientKidPK({
            clientId: client.id,
            kid: msg.data.kid,
          }),
          consumerId: client.consumerId,
          clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
          publicKey: pem,
          GSIPK_clientId: client.id,
          GSIPK_kid: makeGSIPKKid(msg.data.kid),
          updatedAt: new Date().toISOString(),
        };
        await upsertTokenClientKidEntry(clientKidEntry, dynamoDBClient);
      }
    })
    .with({ type: "ClientKeyDeleted" }, async (msg) => {
      const client = parseClient(msg.data.client, msg.type);
      const pk = makePlatformStatesClientPK(client.id);
      const clientEntry = await readClientEntry(pk, dynamoDBClient);

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

      const GSIPK_kid = makeGSIPKKid(msg.data.kid);
      await deleteEntriesFromTokenStatesByKid(GSIPK_kid, dynamoDBClient);
    })
    .with({ type: "ClientPurposeAdded" }, async (msg) => {
      const client = parseClient(msg.data.client, msg.type);

      // platform-states
      const platformClientEntryPK = makePlatformStatesClientPK(client.id);
      const clientEntry = await readClientEntry(
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
      const tokenClientEntries = await readClientEntriesInTokenGenerationStates(
        GSIPK_clientId,
        dynamoDBClient
      );
      if (tokenClientEntries.length === 0) {
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
        const addedTokenClientPurposeEntries = await Promise.all(
          tokenClientEntries.map(async (entry) => {
            const parsedTokenClientEntry =
              TokenGenerationStatesClientEntry.safeParse(entry);
            const parsedTokenClientPurposeEntry =
              TokenGenerationStatesClientPurposeEntry.safeParse(entry);

            if (parsedTokenClientEntry.success) {
              const newTokenClientPurposeEntry = createTokenClientPurposeEntry({
                tokenEntry: parsedTokenClientEntry.data,
                kid: extractKidFromTokenEntryPK(parsedTokenClientEntry.data.PK),
                clientId: client.id,
                consumerId: client.consumerId,
                purposeId,
                purposeEntry,
                agreementEntry,
                catalogEntry,
              });

              await upsertTokenStateClientPurposeEntry(
                newTokenClientPurposeEntry,
                dynamoDBClient
              );
              await deleteClientEntryFromTokenGenerationStatesTable(
                entry,
                dynamoDBClient
              );
              return newTokenClientPurposeEntry;
            }

            if (parsedTokenClientPurposeEntry.success) {
              const kid = extractKidFromTokenEntryPK(
                parsedTokenClientPurposeEntry.data.PK
              );
              if (!seenKids.has(kid)) {
                const newTokenClientPurposeEntry =
                  createTokenClientPurposeEntry({
                    tokenEntry: parsedTokenClientPurposeEntry.data,
                    kid,
                    clientId: client.id,
                    consumerId: client.consumerId,
                    purposeId,
                    purposeEntry,
                    agreementEntry,
                    catalogEntry,
                  });

                await upsertTokenStateClientPurposeEntry(
                  newTokenClientPurposeEntry,
                  dynamoDBClient
                );
                seenKids.add(kid);
                return newTokenClientPurposeEntry;
              }
            }

            throw genericInternalError(`Unable to parse ${entry}`);
          })
        );

        // Second check for updated fields
        await Promise.all(
          addedTokenClientPurposeEntries.map(async (entry) => {
            const {
              purposeEntry: purposeEntry2,
              agreementEntry: agreementEntry2,
              catalogEntry: catalogEntry2,
            } = await retrievePlatformStatesByPurpose(
              purposeId,
              dynamoDBClient,
              logger
            );

            await updateTokenDataForSecondRetrieval({
              dynamoDBClient,
              entry,
              purposeEntry: purposeEntry2,
              agreementEntry: agreementEntry2,
              catalogEntry: catalogEntry2,
            });
          })
        );
      }
    })
    .with({ type: "ClientPurposeRemoved" }, async (msg) => {
      const client = parseClient(msg.data.client, msg.type);
      const pk = makePlatformStatesClientPK(client.id);
      const clientEntry = await readClientEntry(pk, dynamoDBClient);

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
            await deleteEntriesWithClientAndPurposeFromTokenGenerationStatesTable(
              GSIPK_clientId_purposeId,
              dynamoDBClient
            );
          } else {
            await convertEntriesToClientKidInTokenGenerationStates(
              GSIPK_clientId_purposeId,
              dynamoDBClient
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
      await deleteEntriesFromTokenStatesByClient(
        GSIPK_clientId,
        dynamoDBClient
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
