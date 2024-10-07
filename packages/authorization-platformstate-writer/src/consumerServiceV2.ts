import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  AuthorizationEventEnvelopeV2,
  Client,
  ClientV2,
  fromClientV2,
  genericInternalError,
  itemState,
  makeGSIPKClient,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makeGSIPKKid,
  makePlatformStatesClientPK,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  missingKafkaMessageDataError,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesPurposeEntry,
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
  readCatalogEntry,
  readClientEntry,
  readPlatformAgreementEntryByGSIPKConsumerIdEServiceId,
  readPlatformPurposeEntry,
  writeClientEntry,
  writeTokenStateClientEntry,
  writeTokenStateClientPurposeEntry,
  readClientEntriesInTokenGenerationStates,
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
            const retrieveStatesByPurposes = (
              purposes: PurposeId[]
            ): Array<
              Promise<{
                purposeEntry: PlatformStatesPurposeEntry;
                agreementEntry: PlatformStatesAgreementEntry;
                catalogEntry: PlatformStatesCatalogEntry;
              }>
            > =>
              purposes.map(async (purposeId) => {
                const purposePK = makePlatformStatesPurposePK(purposeId);
                const purposeEntry = await readPlatformPurposeEntry(
                  dynamoDBClient,
                  purposePK
                );

                if (!purposeEntry) {
                  throw genericInternalError("TODO throw this error?");
                }

                const agreementGSI = makeGSIPKConsumerIdEServiceId({
                  eserviceId: purposeEntry.purposeEserviceId,
                  consumerId: purposeEntry.purposeConsumerId,
                });

                const agreementEntry =
                  await readPlatformAgreementEntryByGSIPKConsumerIdEServiceId(
                    dynamoDBClient,
                    agreementGSI
                  );

                if (!agreementEntry) {
                  throw genericInternalError("TODO throw this error?");
                }

                const catalogPK = makePlatformStatesEServiceDescriptorPK({
                  eserviceId: purposeEntry.purposeEserviceId,
                  descriptorId: agreementEntry.agreementDescriptorId,
                });
                const catalogEntry = await readCatalogEntry(
                  catalogPK,
                  dynamoDBClient
                );

                if (!catalogEntry) {
                  throw genericInternalError("TODO throw this error?");
                }
                return {
                  purposeEntry,
                  agreementEntry,
                  catalogEntry,
                };
              });

            const currentStates = await Promise.all(
              retrieveStatesByPurposes(client.purposes)
            );

            for (const purposeId of client.purposes) {
              const purposePK = makePlatformStatesPurposePK(purposeId);

              const purposeEntry = currentStates.find(
                (state) => state.purposeEntry.PK === purposePK
              )?.purposeEntry;

              if (!purposeEntry) {
                throw genericInternalError("TODO throw this error?");
              }

              const agreementGSI = makeGSIPKConsumerIdEServiceId({
                eserviceId: purposeEntry.purposeEserviceId,
                consumerId: purposeEntry.purposeConsumerId,
              });

              const agreementEntry = currentStates.find(
                (state) =>
                  state.agreementEntry.GSIPK_consumerId_eserviceId ===
                  agreementGSI
              )?.agreementEntry;

              if (!agreementEntry) {
                throw genericInternalError("TODO throw this error?");
              }

              const catalogPK = makePlatformStatesEServiceDescriptorPK({
                eserviceId: purposeEntry.purposeEserviceId,
                descriptorId: agreementEntry.agreementDescriptorId,
              });
              const catalogEntry = currentStates.find(
                (state) => state.catalogEntry.PK === catalogPK
              )?.catalogEntry;

              if (!catalogEntry) {
                throw genericInternalError("TODO throw this error?");
              }

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
                      eserviceId: purposeEntry.purposeEserviceId,
                      descriptorId: agreementEntry.agreementDescriptorId,
                    }),
                  agreementState: agreementEntry.state,
                  GSIPK_purposeId: purposeId,
                  purposeState: purposeEntry.state,
                  purposeVersionId: purposeEntry.purposeVersionId,
                  GSIPK_clientId: client.id,
                  GSIPK_kid: msg.data.kid,
                  GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
                    clientId: client.id,
                    purposeId,
                  }),
                  publicKey: pem,
                  updatedAt: new Date().toISOString(),
                };

              await writeTokenStateClientPurposeEntry(
                clientKidPurposeEntry,
                dynamoDBClient
              );
            }

            // const secondRetrievalStates = await Promise.all(
            //   retrieveStatesByPurposes(client.purposes)
            // );

            // TODO update the ones whose state has changed
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
              updatedAt: new Date().toISOString(), // TODO new Date() ?
            };
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
          updatedAt: new Date().toISOString(), // TODO new Date() ?
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
          // TODO update
          // what to do? If purposeIds has not to be populated
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

      const GSIPK_clientId = makeGSIPKClient(client.id);
      const tokenStates = await readClientEntriesInTokenGenerationStates(
        GSIPK_clientId,
        dynamoDBClient
      );
      if (tokenStates.length === 0) {
        return Promise.resolve();
      } else {
        // TODO
        // const entries = read states from platform states
        /*
        entries are ClientKid or ClientKidPurpose.
        Based on this discrimination, do different operations.

        For ClientKid: duplicate entry but make it a ClientKidPurpose (and also add GSI_PurposeId)

        For ClientKidPurpose: 
        */
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
            // TODO cleanPurposeIdsInPlatformStateClientEntry();
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
      } else {
        // TODO not sure about this
      }
    })
    .with({ type: "ClientDeleted" }, async (msg) => {
      const client = parseClient(msg.data.client, msg.type);
      const pk = makePlatformStatesClientPK(client.id);
      await deleteClientEntryFromPlatformStates(pk, dynamoDBClient);

      const GSIPK_clientId = makeGSIPKClient(client.id);
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
