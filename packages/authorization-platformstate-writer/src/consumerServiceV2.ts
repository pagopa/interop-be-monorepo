import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  AuthorizationEventEnvelopeV2,
  Client,
  clientKindTokenStates,
  ClientV2,
  fromClientV2,
  genericInternalError,
  itemState,
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
import { match } from "ts-pattern";
import {
  clientKindToTokenGenerationStatesClientKind,
  convertEntriesToClientKidInTokenGenerationStates,
  deleteClientEntryFromPlatformStates,
  deleteEntriesFromTokenStatesByClient,
  deleteEntriesFromTokenStatesByKid,
  deleteEntriesWithClientAndPurposeFromTokenGenerationStatesTable,
  readClientEntry,
  writeClientEntry,
  writeTokenStateClientPurposeEntry,
  readClientEntriesInTokenGenerationStates,
  cleanClientPurposeIdsInPlatformStatesEntry,
  deleteClientEntryFromTokenGenerationStatesTable,
  extractKidFromTokenEntryPK,
  extractAgreementIdFromAgreementPK,
  retrievePlatformStatesByPurpose,
  updateTokenEntriesWithPlatformStatesData,
  upsertPlatformClientEntry,
  upsertTokenClientKidEntry,
} from "./utils.js";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient
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

      const pk = makePlatformStatesClientPK(client.id);
      const clientEntry = await readClientEntry(pk, dynamoDBClient);

      if (clientEntry && clientEntry.version > msg.version) {
        return Promise.resolve();
      } else {
        const platformClientEntry: PlatformStatesClientEntry = {
          PK: pk,
          state: itemState.active,
          clientPurposesIds: [],
          version: msg.version,
          updatedAt: new Date().toISOString(),
        };
        await upsertPlatformClientEntry(dynamoDBClient, platformClientEntry);
      }

      if (client.purposes.length > 0) {
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

        for (const purposeId of client.purposes) {
          const states = await retrievePlatformStatesByPurpose(
            dynamoDBClient,
            purposeId
          );
          map.set(purposeId, states);

          const pk = makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: msg.data.kid,
            purposeId,
          });
          PKsOfAddedEntries.add(pk);

          const clientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
            {
              PK: pk,
              consumerId: client.consumerId,
              clientKind: clientKindToTokenGenerationStatesClientKind(
                client.kind
              ),
              GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
                eserviceId: states.purposeEntry.purposeEserviceId,
                descriptorId: states.agreementEntry.agreementDescriptorId,
              }),
              agreementState: states.agreementEntry.state,
              GSIPK_purposeId: purposeId,
              purposeState: states.purposeEntry.state,
              purposeVersionId: states.purposeEntry.purposeVersionId,
              GSIPK_clientId: client.id,
              GSIPK_kid: makeGSIPKKid(msg.data.kid),
              GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
                clientId: client.id,
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
              clientId: client.id,
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
        await upsertTokenClientKidEntry(dynamoDBClient, clientKidEntry);
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
          clientPurposesIds: [],
          version: msg.version,
          updatedAt: new Date().toISOString(),
        };
        await upsertPlatformClientEntry(dynamoDBClient, platformClientEntry);
      }

      const GSIPK_kid = makeGSIPKKid(msg.data.kid);
      await deleteEntriesFromTokenStatesByKid(GSIPK_kid, dynamoDBClient);
    })
    // eslint-disable-next-line sonarjs/cognitive-complexity
    .with({ type: "ClientPurposeAdded" }, async (msg) => {
      const client = parseClient(msg.data.client, msg.type);

      const pk = makePlatformStatesClientPK(client.id);
      const clientEntry = await readClientEntry(pk, dynamoDBClient);
      if (clientEntry) {
        if (clientEntry.version > msg.version) {
          return Promise.resolve();
        } else {
          await cleanClientPurposeIdsInPlatformStatesEntry(
            dynamoDBClient,
            pk,
            msg.version
          );
        }
      } else {
        const clientEntryPK = makePlatformStatesClientPK(client.id);
        const clientEntry: PlatformStatesClientEntry = {
          PK: clientEntryPK,
          state: itemState.active,
          clientPurposesIds: [],
          version: 1,
          updatedAt: new Date().toISOString(),
        };
        await writeClientEntry(clientEntry, dynamoDBClient);
      }

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
          await retrievePlatformStatesByPurpose(dynamoDBClient, purposeId);

        const PKsOfAddedEntries =
          new Set<TokenGenerationStatesClientKidPurposePK>();
        const kidSet = new Set<string>();
        for (const entry of tokenClientEntries) {
          // TODO: improve this to differentiate between client and client purpose entries
          if (
            TokenGenerationStatesClientPurposeEntry.safeParse(entry).success
          ) {
            const kid = extractKidFromTokenEntryPK(entry.PK);
            if (!kidSet.has(kid)) {
              const pk = makeTokenGenerationStatesClientKidPurposePK({
                clientId: client.id,
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
                  GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
                    clientId: client.id,
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
              await writeTokenStateClientPurposeEntry(
                newClientPurposeEntry,
                dynamoDBClient
              );

              kidSet.add(kid);
            }
          } else if (
            TokenGenerationStatesClientEntry.safeParse(entry).success
          ) {
            const pk = makeTokenGenerationStatesClientKidPurposePK({
              clientId: client.id,
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
                GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
                  clientId: client.id,
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
            await writeTokenStateClientPurposeEntry(
              // TODO make it upsert?
              newTokenClientPurposeEntry,
              dynamoDBClient
            );
            await deleteClientEntryFromTokenGenerationStatesTable(
              entry,
              dynamoDBClient
            );
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
            clientId: client.id,
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
          if (client.purposes.length > 0) {
            // platform-states
            await cleanClientPurposeIdsInPlatformStatesEntry(
              dynamoDBClient,
              pk,
              msg.version
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

export const parseClient = (
  clientV2: ClientV2 | undefined,
  eventType: string
): Client => {
  if (!clientV2) {
    throw missingKafkaMessageDataError("client", eventType);
  }

  return fromClientV2(clientV2);
};
