import { match } from "ts-pattern";
import {
  AuthorizationEventEnvelopeV1,
  Client,
  ClientId,
  clientKidPrefix,
  clientKidPurposePrefix,
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
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  clientKindToTokenGenerationStatesClientKind,
  convertEntriesToClientKidInTokenGenerationStates,
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
        await upsertPlatformClientEntry(dynamoDBClient, updatedClientEntry);
      }
    })
    // eslint-disable-next-line sonarjs/cognitive-complexity
    .with({ type: "KeysAdded" }, async (msg) => {
      const keyV1 = msg.data.keys[0].value;

      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);
      const key = parseKey(keyV1, msg.type);
      const kid = key.kid;

      const pem = key.encodedPem;
      if (!pem) {
        throw missingKafkaMessageDataError("key", msg.type);
      }

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
        await upsertPlatformClientEntry(dynamoDBClient, platformClientEntry);

        if (platformClientEntry.clientPurposesIds.length > 0) {
          const map: Map<PurposeId, TokenGenerationStatesClientPurposeEntry> =
            new Map();

          for (const purposeId of clientPurposesIds) {
            const states = await retrievePlatformStatesByPurpose(
              dynamoDBClient,
              purposeId
            );

            const pk = makeTokenGenerationStatesClientKidPurposePK({
              clientId,
              kid,
              purposeId,
            });

            const clientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
              {
                PK: pk,
                consumerId: platformClientEntry.clientConsumerId,
                clientKind: platformClientEntry.clientKind,
                GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
                  eserviceId: states.purposeEntry.purposeEserviceId,
                  descriptorId: states.agreementEntry.agreementDescriptorId,
                }),
                agreementState: states.agreementEntry.state,
                GSIPK_purposeId: purposeId,
                purposeState: states.purposeEntry.state,
                purposeVersionId: states.purposeEntry.purposeVersionId,
                GSIPK_clientId: clientId,
                GSIPK_kid: makeGSIPKKid(kid),
                GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
                  clientId,
                  purposeId,
                }),
                publicKey: pem,
                updatedAt: new Date().toISOString(),
              };

            await upsertTokenStateClientPurposeEntry(
              clientKidPurposeEntry,
              dynamoDBClient
            );

            map.set(purposeId, clientKidPurposeEntry);
          }

          for (const purposeId of clientPurposesIds) {
            const secondRetrievalStates = await retrievePlatformStatesByPurpose(
              dynamoDBClient,
              purposeId
            );
            const addedClientKidPurposeEntry = map.get(purposeId);

            if (!addedClientKidPurposeEntry) {
              throw genericInternalError(
                `Error during upsert for entry related to purpose id: ${purposeId}`
              );
            }
            if (
              secondRetrievalStates.agreementEntry.state !==
                addedClientKidPurposeEntry.agreementState ||
              secondRetrievalStates.catalogEntry.state !==
                addedClientKidPurposeEntry.descriptorState ||
              secondRetrievalStates.purposeEntry.state !==
                addedClientKidPurposeEntry.purposeState
            ) {
              const updatedTokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry =
                {
                  ...addedClientKidPurposeEntry,
                  GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
                    consumerId: platformClientEntry.clientConsumerId,
                    eserviceId:
                      secondRetrievalStates.purposeEntry.purposeEserviceId,
                  }),
                  agreementId: extractAgreementIdFromAgreementPK(
                    secondRetrievalStates.agreementEntry.PK
                  ),
                  agreementState: secondRetrievalStates.agreementEntry.state,
                  GSIPK_eserviceId_descriptorId:
                    makeGSIPKEServiceIdDescriptorId({
                      eserviceId:
                        secondRetrievalStates.purposeEntry.purposeEserviceId,
                      descriptorId:
                        secondRetrievalStates.agreementEntry
                          .agreementDescriptorId,
                    }),
                  descriptorState: secondRetrievalStates.agreementEntry.state,
                  descriptorAudience:
                    secondRetrievalStates.catalogEntry.descriptorAudience,
                  descriptorVoucherLifespan:
                    secondRetrievalStates.catalogEntry
                      .descriptorVoucherLifespan,
                  purposeState: secondRetrievalStates.purposeEntry.state,
                  purposeVersionId:
                    secondRetrievalStates.purposeEntry.purposeVersionId,
                  updatedAt: new Date().toISOString(),
                };

              await upsertTokenStateClientPurposeEntry(
                updatedTokenClientPurposeEntry,
                dynamoDBClient
              );
            }
          }
        } else {
          const clientKidEntry: TokenGenerationStatesClientEntry = {
            PK: makeTokenGenerationStatesClientKidPK({
              clientId,
              kid,
            }),
            consumerId: platformClientEntry.clientConsumerId,
            clientKind: platformClientEntry.clientKind,
            publicKey: pem,
            GSIPK_clientId: clientId,
            GSIPK_kid: makeGSIPKKid(kid),
            updatedAt: new Date().toISOString(),
          };
          await upsertTokenClientKidEntry(dynamoDBClient, clientKidEntry);
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
        await upsertPlatformClientEntry(dynamoDBClient, platformClientEntry);

        const GSIPK_kid = makeGSIPKKid(msg.data.keyId);
        await deleteEntriesFromTokenStatesByKid(GSIPK_kid, dynamoDBClient);
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
      const clientEntry = await readClientEntry(pk, dynamoDBClient);
      if (!clientEntry || clientEntry.version > msg.version) {
        return Promise.resolve();
      } else {
        const purposeIds = [...clientEntry.clientPurposesIds, purposeId];
        await setClientPurposeIdsInPlatformStatesEntry(
          dynamoDBClient,
          pk,
          msg.version,
          purposeIds
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
          await retrievePlatformStatesByPurpose(dynamoDBClient, purposeId);

        const addedTokenClientPurposeEntries =
          new Array<TokenGenerationStatesClientPurposeEntry>();
        const kidSet = new Set<string>();
        for (const entry of tokenClientEntries) {
          if (entry.PK.startsWith(clientKidPrefix)) {
            const kid = extractKidFromTokenEntryPK(entry.PK);
            const pk = makeTokenGenerationStatesClientKidPurposePK({
              clientId,
              kid,
              purposeId,
            });
            const newTokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry =
              {
                consumerId: entry.consumerId,
                updatedAt: new Date().toISOString(),
                PK: pk,
                clientKind: clientKindTokenStates.consumer,
                publicKey: entry.publicKey,
                GSIPK_clientId: entry.GSIPK_clientId,
                GSIPK_kid: makeGSIPKKid(kid),
                GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
                  clientId,
                  purposeId,
                }),
                GSIPK_purposeId: purposeId,
                purposeState: purposeEntry.state,
                purposeVersionId: purposeEntry.purposeVersionId,
                GSIPK_consumerId_eserviceId:
                  agreementEntry.GSIPK_consumerId_eserviceId,
                agreementId: extractAgreementIdFromAgreementPK(
                  agreementEntry.PK
                ),
                agreementState: agreementEntry.state,
                GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
                  eserviceId: purposeEntry.purposeEserviceId,
                  descriptorId: agreementEntry.agreementDescriptorId,
                }),
                descriptorState: catalogEntry.state,
                descriptorAudience: catalogEntry.descriptorAudience,
                descriptorVoucherLifespan:
                  catalogEntry.descriptorVoucherLifespan,
              };

            await upsertTokenStateClientPurposeEntry(
              newTokenClientPurposeEntry,
              dynamoDBClient
            );
            await deleteClientEntryFromTokenGenerationStatesTable(
              entry,
              dynamoDBClient
            );
          } else if (entry.PK.startsWith(clientKidPurposePrefix)) {
            const kid = extractKidFromTokenEntryPK(entry.PK);
            if (!kidSet.has(kid)) {
              const pk = makeTokenGenerationStatesClientKidPurposePK({
                clientId,
                kid,
                purposeId,
              });

              const newClientPurposeEntry: TokenGenerationStatesClientPurposeEntry =
                {
                  consumerId: entry.consumerId,
                  updatedAt: new Date().toISOString(),
                  PK: pk,
                  clientKind: entry.clientKind,
                  publicKey: entry.publicKey,
                  GSIPK_clientId: entry.GSIPK_clientId,
                  GSIPK_kid: entry.GSIPK_kid,
                  GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
                    clientId,
                    purposeId,
                  }),
                  GSIPK_purposeId: purposeId,
                  purposeState: purposeEntry.state,
                  purposeVersionId: purposeEntry.purposeVersionId,
                  GSIPK_consumerId_eserviceId:
                    agreementEntry.GSIPK_consumerId_eserviceId,
                  agreementId: extractAgreementIdFromAgreementPK(
                    agreementEntry.PK
                  ),
                  agreementState: agreementEntry.state,
                  GSIPK_eserviceId_descriptorId:
                    makeGSIPKEServiceIdDescriptorId({
                      eserviceId: purposeEntry.purposeEserviceId,
                      descriptorId: agreementEntry.agreementDescriptorId,
                    }),
                  descriptorState: catalogEntry.state,
                  descriptorAudience: catalogEntry.descriptorAudience,
                  descriptorVoucherLifespan:
                    catalogEntry.descriptorVoucherLifespan,
                };

              await upsertTokenStateClientPurposeEntry(
                newClientPurposeEntry,
                dynamoDBClient
              );

              kidSet.add(kid);
              // eslint-disable-next-line functional/immutable-data
              addedTokenClientPurposeEntries.push(newClientPurposeEntry);
            }
          } else {
            throw genericInternalError(`Unable to parse ${entry}`);
          }

          const secondRetrievalStates = await retrievePlatformStatesByPurpose(
            dynamoDBClient,
            purposeId
          );

          for (const clientPurposeEntry of addedTokenClientPurposeEntries) {
            if (
              secondRetrievalStates.agreementEntry.state !==
                agreementEntry.state ||
              secondRetrievalStates.catalogEntry.state !== catalogEntry.state ||
              secondRetrievalStates.purposeEntry.state !== purposeEntry.state
            ) {
              const updatedTokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry =
                {
                  ...clientPurposeEntry,
                  GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
                    consumerId: clientEntry.clientConsumerId,
                    eserviceId:
                      secondRetrievalStates.purposeEntry.purposeEserviceId,
                  }),
                  agreementId: extractAgreementIdFromAgreementPK(
                    secondRetrievalStates.agreementEntry.PK
                  ),
                  agreementState: secondRetrievalStates.agreementEntry.state,
                  GSIPK_eserviceId_descriptorId:
                    makeGSIPKEServiceIdDescriptorId({
                      eserviceId:
                        secondRetrievalStates.purposeEntry.purposeEserviceId,
                      descriptorId:
                        secondRetrievalStates.agreementEntry
                          .agreementDescriptorId,
                    }),
                  descriptorState: secondRetrievalStates.agreementEntry.state,
                  descriptorAudience:
                    secondRetrievalStates.catalogEntry.descriptorAudience,
                  descriptorVoucherLifespan:
                    secondRetrievalStates.catalogEntry
                      .descriptorVoucherLifespan,
                  purposeState: secondRetrievalStates.purposeEntry.state,
                  purposeVersionId:
                    secondRetrievalStates.purposeEntry.purposeVersionId,
                  updatedAt: new Date().toISOString(),
                };

              await upsertTokenStateClientPurposeEntry(
                updatedTokenClientPurposeEntry,
                dynamoDBClient
              );
            }
          }
        }
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

          if (updatedPurposeIds.length > 0) {
            // platform-states
            await setClientPurposeIdsInPlatformStatesEntry(
              dynamoDBClient,
              pk,
              msg.version,
              updatedPurposeIds
            );

            // token-generation-states
            await deleteEntriesWithClientAndPurposeFromTokenGenerationStatesTable(
              GSIPK_clientId_purposeId,
              dynamoDBClient
            );
          } else {
            // platform-states
            await deleteClientEntryFromPlatformStates(pk, dynamoDBClient);

            // token-generation-states
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
