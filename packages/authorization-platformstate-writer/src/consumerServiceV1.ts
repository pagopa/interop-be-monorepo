import { match } from "ts-pattern";
import {
  AuthorizationEventEnvelopeV1,
  Client,
  ClientId,
  clientKindTokenStates,
  ClientV1,
  fromClientV1,
  fromKeyV1,
  generateId,
  genericInternalError,
  itemState,
  Key,
  KeyV1,
  makeGSIPKClientIdPurposeId,
  makeGSIPKEServiceIdDescriptorId,
  makeGSIPKKid,
  makePlatformStatesClientPK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  missingKafkaMessageDataError,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesPurposeEntry,
  PurposeId,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesClientPurposeEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
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
  updateTokenEntriesWithPlatformStatesData,
  upsertPlatformClientEntry,
  upsertTokenClientKidEntry,
  writeTokenStateClientPurposeEntry,
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
        const updatedClientEntry: PlatformStatesClientEntry = {
          PK: pk,
          version: msg.version,
          state: itemState.active,
          clientKind: clientEntry.clientKind,
          clientConsumerId: clientEntry.clientConsumerId,
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
          const map: Map<
            PurposeId,
            {
              purposeEntry: PlatformStatesPurposeEntry;
              agreementEntry: PlatformStatesAgreementEntry;
              catalogEntry: PlatformStatesCatalogEntry;
            }
          > = new Map();

          const PKsOfAddedEntries =
            new Set<TokenGenerationStatesClientKidPurposePK>();

          for (const purposeId of clientPurposesIds) {
            const states = await retrievePlatformStatesByPurpose(
              dynamoDBClient,
              purposeId
            );
            map.set(purposeId, states);

            const pk = makeTokenGenerationStatesClientKidPurposePK({
              clientId,
              kid,
              purposeId,
            });
            PKsOfAddedEntries.add(pk);

            const clientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
              {
                PK: pk,
                consumerId: states.purposeEntry.purposeConsumerId, // TODO double check
                clientKind: clientKindTokenStates.consumer, // TODO
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

            // TODO: upsert
            await writeTokenStateClientPurposeEntry(
              clientKidPurposeEntry,
              dynamoDBClient
            );
            // }
            // TODO this two loops can be merged or should they be completely separated?
            // for (const purposeId of client.purposes) {
            const secondRetrievalStates = await retrievePlatformStatesByPurpose(
              dynamoDBClient,
              purposeId
            );
            const { agreementEntry, catalogEntry, purposeEntry } =
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              map.get(purposeId)!;

            if (
              secondRetrievalStates.agreementEntry.state !==
                agreementEntry.state ||
              secondRetrievalStates.catalogEntry.state !== catalogEntry.state ||
              secondRetrievalStates.purposeEntry.state !== purposeEntry.state
            ) {
              await updateTokenEntriesWithPlatformStatesData({
                clientId,
                purposeId,
                agreementEntry: secondRetrievalStates.agreementEntry,
                catalogEntry: secondRetrievalStates.catalogEntry,
                purposeEntry: secondRetrievalStates.purposeEntry,
                dynamoDBClient,
                pkOfEntriesToUpdate: PKsOfAddedEntries,
              });
            }
          }
        } else {
          const clientKidEntry: TokenGenerationStatesClientEntry = {
            PK: makeTokenGenerationStatesClientKidPK({
              clientId,
              kid,
            }),
            consumerId: generateId(), // TODO
            clientKind: clientKindTokenStates.api, // TODO
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

        const PKsOfAddedEntries =
          new Set<TokenGenerationStatesClientKidPurposePK>();
        const kidMap = new Set<string>();
        for (const entry of tokenClientEntries) {
          // TODO: improve this to differentiate between client and client purpose entries
          if (TokenGenerationStatesClientEntry.safeParse(entry)) {
            const pk = makeTokenGenerationStatesClientKidPurposePK({
              clientId,
              kid: extractKidFromTokenEntryPK(entry.PK),
              purposeId,
            });
            PKsOfAddedEntries.add(pk);
            const newTokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry =
              {
                consumerId: entry.consumerId,
                updatedAt: new Date().toISOString(),
                PK: pk,
                clientKind: entry.clientKind,
                publicKey: entry.publicKey,
                GSIPK_clientId: entry.GSIPK_clientId,
                GSIPK_kid: entry.GSIPK_kid,
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
            await writeTokenStateClientPurposeEntry(
              // TODO make it upsert?
              newTokenClientPurposeEntry,
              dynamoDBClient
            );
            await deleteClientEntryFromTokenGenerationStatesTable(
              entry,
              dynamoDBClient
            );
          } else if (TokenGenerationStatesClientPurposeEntry.safeParse(entry)) {
            const kid = extractKidFromTokenEntryPK(entry.PK);

            if (!kidMap.has(kid)) {
              const pk = makeTokenGenerationStatesClientKidPurposePK({
                clientId,
                kid,
                purposeId,
              });

              PKsOfAddedEntries.add(pk);
              const newClientPurposeEntry: TokenGenerationStatesClientPurposeEntry =
                {
                  consumerId: entry.consumerId,
                  updatedAt: new Date().toISOString(),
                  PK: pk,
                  clientKind: clientKindTokenStates.consumer,
                  publicKey: entry.publicKey,
                  GSIPK_clientId: entry.GSIPK_clientId,
                  GSIPK_kid: makeGSIPKKid(kid),
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

              await writeTokenStateClientPurposeEntry(
                newClientPurposeEntry,
                dynamoDBClient
              );

              kidMap.add(kid);
            }
          } else {
            throw genericInternalError(`Unable to parse ${entry}`);
          }
        }

        const secondRetrievalStates = await retrievePlatformStatesByPurpose(
          dynamoDBClient,
          purposeId
        );

        if (
          secondRetrievalStates.agreementEntry.state !== agreementEntry.state ||
          secondRetrievalStates.catalogEntry.state !== catalogEntry.state ||
          secondRetrievalStates.purposeEntry.state !== purposeEntry.state
        ) {
          await updateTokenEntriesWithPlatformStatesData({
            clientId,
            purposeId,
            agreementEntry: secondRetrievalStates.agreementEntry,
            catalogEntry: secondRetrievalStates.catalogEntry,
            purposeEntry: secondRetrievalStates.purposeEntry,
            dynamoDBClient,
            pkOfEntriesToUpdate: PKsOfAddedEntries,
          });
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

          if (updatedPurposeIds.length === 0) {
            await deleteClientEntryFromPlatformStates(pk, dynamoDBClient);

            // token-generation-states
            await convertEntriesToClientKidInTokenGenerationStates(
              GSIPK_clientId_purposeId,
              dynamoDBClient
            );
          } else {
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

export const parseClient = (
  clientV1: ClientV1 | undefined,
  eventType: string
): Client => {
  if (!clientV1) {
    throw missingKafkaMessageDataError("client", eventType);
  }

  return fromClientV1(clientV1);
};
