import { match } from "ts-pattern";
import {
  AuthorizationEventEnvelopeV1,
  Client,
  ClientId,
  clientKindTokenStates,
  ClientV1,
  fromClientV1,
  fromKeyV1,
  genericInternalError,
  itemState,
  Key,
  KeyV1,
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
  TokenGenerationStatesApiClient,
  TokenGenerationStatesConsumerClient,
  unsafeBrandId,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  clientKindToTokenGenerationStatesClientKind,
  convertEntriesToClientKidInTokenGenerationStates,
  createTokenClientPurposeEntry,
  deleteClientEntryFromPlatformStates,
  deleteClientEntryFromTokenGenerationStatesTable,
  deleteEntriesFromTokenStatesByClient,
  deleteEntriesFromTokenStatesByKid,
  deleteEntriesWithClientAndPurposeFromTokenGenerationStatesTable,
  extractAgreementIdFromAgreementPK,
  extractKidFromTokenEntryPK,
  readClientEntriesInTokenGenerationStates,
  readClientEntry,
  retrievePlatformStatesByPurpose,
  setClientPurposeIdsInPlatformStatesEntry,
  updateTokenDataForSecondRetrieval,
  upsertPlatformClientEntry,
  upsertTokenClientKidEntry,
  upsertTokenStateClientPurposeEntry,
} from "./utils.js";

export async function handleMessageV1(
  message: AuthorizationEventEnvelopeV1,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "ClientAdded" }, async (msg) => {
      const client = parseClient(msg.data.client, msg.type);

      const pk = makePlatformStatesClientPK(client.id);
      const clientEntry = await readClientEntry(pk, dynamoDBClient);

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
    .with({ type: "KeysAdded" }, async (msg) => {
      const keyV1 = msg.data.keys[0].value;

      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);
      const key = parseKey(keyV1, msg.type);
      const kid = key.kid;
      const pem = key.encodedPem;

      const pk = makePlatformStatesClientPK(clientId);
      const clientEntry = await readClientEntry(pk, dynamoDBClient);

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

        if (clientPurposesIds.length > 0) {
          const addedEntries = await Promise.all(
            clientPurposesIds.map(async (purposeId) => {
              const { purposeEntry, agreementEntry, catalogEntry } =
                await retrievePlatformStatesByPurpose(
                  purposeId,
                  dynamoDBClient
                );

              const tokenClientKidPurposePK =
                makeTokenGenerationStatesClientKidPurposePK({
                  clientId,
                  kid,
                  purposeId,
                });

              const clientKidPurposeEntry: TokenGenerationStatesConsumerClient =
                {
                  PK: tokenClientKidPurposePK,
                  consumerId: platformClientEntry.clientConsumerId,
                  clientKind: clientKindTokenStates.consumer,
                  publicKey: pem,
                  updatedAt: new Date().toISOString(),
                  GSIPK_clientId: clientId,
                  GSIPK_kid: makeGSIPKKid(kid),
                  GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
                    clientId,
                    purposeId,
                  }),
                  GSIPK_purposeId: purposeId,
                  ...((purposeEntry && {
                    GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
                      consumerId: platformClientEntry.clientConsumerId,
                      eserviceId: purposeEntry.purposeEserviceId,
                    }),
                    purposeState: purposeEntry.state,
                    purposeVersionId: purposeEntry.purposeVersionId,
                  }) ||
                    {}),
                  ...((purposeEntry &&
                    agreementEntry && {
                      agreementId: extractAgreementIdFromAgreementPK(
                        agreementEntry.PK
                      ),
                      agreementState: agreementEntry.state,
                      GSIPK_eserviceId_descriptorId:
                        makeGSIPKEServiceIdDescriptorId({
                          eserviceId: purposeEntry.purposeEserviceId,
                          descriptorId: agreementEntry.agreementDescriptorId,
                        }),
                    }) ||
                    {}),
                  ...((catalogEntry && {
                    descriptorState: catalogEntry.state,
                    descriptorAudience: catalogEntry.descriptorAudience,
                    descriptorVoucherLifespan:
                      catalogEntry.descriptorVoucherLifespan,
                  }) ||
                    {}),
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
            clientPurposesIds.map(async (purposeId, index) => {
              const {
                purposeEntry: purposeEntry2,
                agreementEntry: agreementEntry2,
                catalogEntry: catalogEntry2,
              } = await retrievePlatformStatesByPurpose(
                purposeId,
                dynamoDBClient
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
          const clientKidEntry: TokenGenerationStatesApiClient = {
            PK: makeTokenGenerationStatesClientKidPK({
              clientId,
              kid,
            }),
            consumerId: platformClientEntry.clientConsumerId,
            clientKind: clientKindTokenStates.api,
            publicKey: pem,
            GSIPK_clientId: clientId,
            GSIPK_kid: makeGSIPKKid(kid),
            updatedAt: new Date().toISOString(),
          };
          await upsertTokenClientKidEntry(clientKidEntry, dynamoDBClient);
        }
      }
    })
    .with({ type: "KeyDeleted" }, async (msg) => {
      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);
      const pk = makePlatformStatesClientPK(clientId);
      const clientEntry = await readClientEntry(pk, dynamoDBClient);

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

        const GSIPK_kid = makeGSIPKKid(msg.data.keyId);
        await deleteEntriesFromTokenStatesByKid(GSIPK_kid, dynamoDBClient);
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
      const clientEntry = await readClientEntry(pk, dynamoDBClient);
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
      }

      const GSIPK_clientId = clientId;
      const tokenClientEntries = await readClientEntriesInTokenGenerationStates(
        GSIPK_clientId,
        dynamoDBClient
      );
      if (tokenClientEntries.length === 0) {
        return Promise.resolve();
      } else {
        const { purposeEntry, agreementEntry, catalogEntry } =
          await retrievePlatformStatesByPurpose(purposeId, dynamoDBClient);

        const seenKids = new Set<string>();
        const addedTokenClientPurposeEntries = await Promise.all(
          tokenClientEntries.map(async (entry) => {
            const parsedTokenClientEntry =
              TokenGenerationStatesApiClient.safeParse(entry);
            const parsedTokenClientPurposeEntry =
              TokenGenerationStatesConsumerClient.safeParse(entry);

            if (parsedTokenClientEntry.success) {
              const newTokenClientPurposeEntry = createTokenClientPurposeEntry({
                tokenEntry: parsedTokenClientEntry.data,
                kid: extractKidFromTokenEntryPK(parsedTokenClientEntry.data.PK),
                clientId,
                consumerId: parsedTokenClientEntry.data.consumerId,
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
                    clientId,
                    consumerId: parsedTokenClientPurposeEntry.data.consumerId,
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
              dynamoDBClient
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
      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);
      const purposeIdToRemove = unsafeBrandId<PurposeId>(msg.data.purposeId);

      const pk = makePlatformStatesClientPK(clientId);
      const clientEntry = await readClientEntry(pk, dynamoDBClient);

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
      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);
      const pk = makePlatformStatesClientPK(clientId);
      await deleteClientEntryFromPlatformStates(pk, dynamoDBClient);

      const GSIPK_clientId = clientId;
      await deleteEntriesFromTokenStatesByClient(
        GSIPK_clientId,
        dynamoDBClient
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
