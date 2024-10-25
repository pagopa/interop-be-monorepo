import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  AuthorizationEventEnvelopeV2,
  Client,
  clientKidPrefix,
  clientKidPurposePrefix,
  clientKindTokenStates,
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
import {
  clientKindToTokenGenerationStatesClientKind,
  convertEntriesToClientKidInTokenGenerationStates,
  deleteClientEntryFromPlatformStates,
  deleteEntriesFromTokenStatesByClient,
  deleteEntriesFromTokenStatesByKid,
  deleteEntriesWithClientAndPurposeFromTokenGenerationStatesTable,
  readClientEntry,
  writeClientEntry,
  readClientEntriesInTokenGenerationStates,
  cleanClientPurposeIdsInPlatformStatesEntry,
  deleteClientEntryFromTokenGenerationStatesTable,
  extractKidFromTokenEntryPK,
  extractAgreementIdFromAgreementPK,
  retrievePlatformStatesByPurpose,
  upsertPlatformClientEntry,
  upsertTokenClientKidEntry,
  upsertTokenStateClientPurposeEntry,
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
          clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
          clientConsumerId: client.consumerId,
          clientPurposesIds: [],
          version: msg.version,
          updatedAt: new Date().toISOString(),
        };
        await upsertPlatformClientEntry(platformClientEntry, dynamoDBClient);
      }
      if (client.purposes.length > 0) {
        const map: Map<PurposeId, TokenGenerationStatesClientPurposeEntry> =
          new Map();

        for (const purposeId of client.purposes) {
          const states = await retrievePlatformStatesByPurpose(
            purposeId,
            dynamoDBClient
          );

          const pk = makeTokenGenerationStatesClientKidPurposePK({
            clientId: client.id,
            kid: msg.data.kid,
            purposeId,
          });

          const clientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
            {
              PK: pk,
              GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
                consumerId: client.consumerId,
                eserviceId: states.purposeEntry.purposeEserviceId,
              }),
              agreementId: extractAgreementIdFromAgreementPK(
                states.agreementEntry.PK
              ),
              agreementState: states.agreementEntry.state,
              GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
                eserviceId: states.purposeEntry.purposeEserviceId,
                descriptorId: states.agreementEntry.agreementDescriptorId,
              }),
              descriptorState: states.agreementEntry.state,
              descriptorAudience: states.catalogEntry.descriptorAudience,
              descriptorVoucherLifespan:
                states.catalogEntry.descriptorVoucherLifespan,
              GSIPK_purposeId: purposeId,
              purposeState: states.purposeEntry.state,
              consumerId: client.consumerId,
              clientKind: clientKindToTokenGenerationStatesClientKind(
                client.kind
              ),
              publicKey: pem,
              purposeVersionId: states.purposeEntry.purposeVersionId,
              GSIPK_clientId: client.id,
              GSIPK_kid: makeGSIPKKid(msg.data.kid),
              GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
                clientId: client.id,
                purposeId,
              }),
              updatedAt: new Date().toISOString(),
            };

          await upsertTokenStateClientPurposeEntry(
            clientKidPurposeEntry,
            dynamoDBClient
          );

          map.set(purposeId, clientKidPurposeEntry);
        }

        for (const purposeId of client.purposes) {
          const secondRetrievalStates = await retrievePlatformStatesByPurpose(
            purposeId,
            dynamoDBClient
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
                  consumerId: client.consumerId,
                  eserviceId:
                    secondRetrievalStates.purposeEntry.purposeEserviceId,
                }),
                agreementId: extractAgreementIdFromAgreementPK(
                  secondRetrievalStates.agreementEntry.PK
                ),
                agreementState: secondRetrievalStates.agreementEntry.state,
                GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
                  eserviceId:
                    secondRetrievalStates.purposeEntry.purposeEserviceId,
                  descriptorId:
                    secondRetrievalStates.agreementEntry.agreementDescriptorId,
                }),
                descriptorState: secondRetrievalStates.agreementEntry.state,
                descriptorAudience:
                  secondRetrievalStates.catalogEntry.descriptorAudience,
                descriptorVoucherLifespan:
                  secondRetrievalStates.catalogEntry.descriptorVoucherLifespan,
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
            pk,
            msg.version,
            dynamoDBClient
          );
        }
      } else {
        const clientEntryPK = makePlatformStatesClientPK(client.id);
        const clientEntry: PlatformStatesClientEntry = {
          PK: clientEntryPK,
          state: itemState.active,
          clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
          clientConsumerId: client.consumerId,
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
          await retrievePlatformStatesByPurpose(purposeId, dynamoDBClient);

        const addedTokenClientPurposeEntries =
          new Array<TokenGenerationStatesClientPurposeEntry>();
        const kidSet = new Set<string>();
        for (const entry of tokenClientEntries) {
          if (entry.PK.startsWith(clientKidPrefix)) {
            const pk = makeTokenGenerationStatesClientKidPurposePK({
              clientId: client.id,
              kid: extractKidFromTokenEntryPK(entry.PK),
              purposeId,
            });
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
            await upsertTokenStateClientPurposeEntry(
              newTokenClientPurposeEntry,
              dynamoDBClient
            );
            await deleteClientEntryFromTokenGenerationStatesTable(
              entry,
              dynamoDBClient
            );
            // eslint-disable-next-line functional/immutable-data
            addedTokenClientPurposeEntries.push(newTokenClientPurposeEntry);
          } else if (entry.PK.startsWith(clientKidPurposePrefix)) {
            const kid = extractKidFromTokenEntryPK(entry.PK);
            if (!kidSet.has(kid)) {
              const pk = makeTokenGenerationStatesClientKidPurposePK({
                clientId: client.id,
                kid,
                purposeId,
              });

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
        }

        const secondRetrievalStates = await retrievePlatformStatesByPurpose(
          purposeId,
          dynamoDBClient
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
                  consumerId: client.consumerId,
                  eserviceId:
                    secondRetrievalStates.purposeEntry.purposeEserviceId,
                }),
                agreementId: extractAgreementIdFromAgreementPK(
                  secondRetrievalStates.agreementEntry.PK
                ),
                agreementState: secondRetrievalStates.agreementEntry.state,
                GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
                  eserviceId:
                    secondRetrievalStates.purposeEntry.purposeEserviceId,
                  descriptorId:
                    secondRetrievalStates.agreementEntry.agreementDescriptorId,
                }),
                descriptorState: secondRetrievalStates.agreementEntry.state,
                descriptorAudience:
                  secondRetrievalStates.catalogEntry.descriptorAudience,
                descriptorVoucherLifespan:
                  secondRetrievalStates.catalogEntry.descriptorVoucherLifespan,
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
              pk,
              msg.version,
              dynamoDBClient
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

const parseClient = (
  clientV2: ClientV2 | undefined,
  eventType: string
): Client => {
  if (!clientV2) {
    throw missingKafkaMessageDataError("client", eventType);
  }

  return fromClientV2(clientV2);
};
