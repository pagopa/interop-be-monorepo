import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  AuthorizationEventEnvelopeV2,
  Client,
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
  TokenGenerationStatesClientKidPK,
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
  writeTokenStateClientEntry,
  writeTokenStateClientPurposeEntry,
  readClientEntriesInTokenGenerationStates,
  cleanClientPurposeIdsInPlatformStatesEntry,
  deleteClientEntryFromTokenGenerationStatesTable,
  extractKidFromClientKidPK,
  extractAgreementIdFromAgreementPK,
  retrievePlatformStatesByPurpose,
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
      if (clientEntry) {
        if (clientEntry.version > msg.version) {
          return Promise.resolve();
        } else {
          if (client.purposes.length > 0) {
            const map: Map<
              PurposeId,
              {
                purposeEntry: PlatformStatesPurposeEntry;
                agreementEntry: PlatformStatesAgreementEntry;
                catalogEntry: PlatformStatesCatalogEntry;
              }
            > = new Map();

            for (const purposeId of client.purposes) {
              const states = await retrievePlatformStatesByPurpose(
                dynamoDBClient,
                purposeId
              );
              map.set(purposeId, states);

              const clientKidPurposeEntry: TokenGenerationStatesClientPurposeEntry =
                {
                  PK: makeTokenGenerationStatesClientKidPurposePK({
                    clientId: client.id,
                    kid: msg.data.kid,
                    purposeId,
                  }),
                  consumerId: client.consumerId,
                  clientKind: clientKindToTokenGenerationStatesClientKind(
                    client.kind
                  ),
                  GSIPK_eserviceId_descriptorId:
                    makeGSIPKEServiceIdDescriptorId({
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
            }

            for (const purposeId of client.purposes) {
              const newStates = await retrievePlatformStatesByPurpose(
                dynamoDBClient,
                purposeId
              );

              const previousState = map.get(purposeId);
              // TODO: compare previous states with new states and update the ones whose state has changed

              // TODO update the ones whose state has changed
            }
          } else {
            const clientKidEntry: TokenGenerationStatesClientEntry = {
              PK: makeTokenGenerationStatesClientKidPK({
                clientId: client.id,
                kid: msg.data.kid,
              }),
              consumerId: client.consumerId,
              clientKind: clientKindToTokenGenerationStatesClientKind(
                client.kind
              ),
              publicKey: pem,
              GSIPK_clientId: client.id,
              GSIPK_kid: makeGSIPKKid(msg.data.kid),
              updatedAt: new Date().toISOString(),
            };
            // TODO: upsert
            await writeTokenStateClientEntry(clientKidEntry, dynamoDBClient);
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
        await writeTokenStateClientEntry(clientKidEntry, dynamoDBClient);
      }
    })
    .with({ type: "ClientKeyDeleted" }, async (msg) => {
      const GSIPK_kid = makeGSIPKKid(msg.data.kid);
      await deleteEntriesFromTokenStatesByKid(GSIPK_kid, dynamoDBClient);
    })
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

        for (const entry of tokenClientEntries) {
          // TODO: improve this to differentiate between client and client purpose entries
          if (TokenGenerationStatesClientEntry.safeParse(entry)) {
            const newTokenClientPurposeEntry: TokenGenerationStatesClientPurposeEntry =
              {
                consumerId: entry.consumerId,
                updatedAt: new Date().toISOString(),
                PK: makeTokenGenerationStatesClientKidPurposePK({
                  clientId: client.id,
                  kid: extractKidFromClientKidPK(
                    // TODO: fix type
                    entry.PK as TokenGenerationStatesClientKidPK
                  ),
                  purposeId,
                }),
                clientKind: entry.clientKind,
                publicKey: entry.publicKey,
                GSIPK_clientId: entry.GSIPK_clientId,
                GSIPK_kid: entry.GSIPK_kid,
                GSIPK_purposeId: purposeId,
                purposeState: purposeEntry.state,
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
              newTokenClientPurposeEntry,
              dynamoDBClient
            );
            // TODO: how to ensure that previous operation has succeeded?
            await deleteClientEntryFromTokenGenerationStatesTable(
              entry,
              dynamoDBClient
            );
          } else if (TokenGenerationStatesClientPurposeEntry.safeParse(entry)) {
            // TODO
          } else {
            throw genericInternalError(`Unable to parse ${entry}`);
          }
        }

        // TODO: check if platform entries changed and update them if they did
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
          if (client.purposes.length === 0) {
            await deleteClientEntryFromPlatformStates(pk, dynamoDBClient);
          } else {
            await cleanClientPurposeIdsInPlatformStatesEntry(
              dynamoDBClient,
              pk,
              msg.version
            );
          }

          // token-generation-states
          const GSIPK_clientId_purposeId = makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: unsafeBrandId(msg.data.purposeId),
          });
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

export const parseClient = (
  clientV2: ClientV2 | undefined,
  eventType: string
): Client => {
  if (!clientV2) {
    throw missingKafkaMessageDataError("client", eventType);
  }

  return fromClientV2(clientV2);
};
