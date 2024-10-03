import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  AuthorizationEventEnvelopeV2,
  Client,
  ClientV2,
  fromClientV2,
  makeGSIPKClient,
  makeGSIPKKid,
  makePlatformStatesClientPK,
  missingKafkaMessageDataError,
  PlatformStatesClientEntry,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  deleteClientEntryFromPlatformStates,
  deleteEntriesFromTokenStatesByClient,
  deleteEntriesFromTokenStatesByKid,
  updatePurposeIdsFromPlatformStateClientEntry,
  updatePurposeIdsInPlatformStateClientEntry,
} from "./utils.js";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "ClientKeyAdded" }, () => {
      // TODO
    })
    .with({ type: "ClientKeyDeleted" }, async (msg) => {
      const GSIPK_kid = makeGSIPKKid(msg.data.kid);
      await deleteEntriesFromTokenStatesByKid(GSIPK_kid, dynamoDBClient);
    })
    .with({ type: "ClientPurposeAdded" }, () => {
      // TODO
    })
    .with({ type: "ClientPurposeRemoved" }, async (msg) => {
      const client = parseClient(msg.data.client, msg.type);
      const pk = makePlatformStatesClientPK(client.id);
      const clientEntry: PlatformStatesClientEntry = await readClientEntry(pk);

      if (clientEntry) {
        if (clientEntry.version > msg.version) {
          return Promise.resolve();
        } else {
          const updatedPurposeIdsArray = clientEntry.clientPurposesIds.filter(
            (id) => id !== msg.data.purposeId
          );

          if (updatedPurposeIdsArray.length === 0) {
            await deleteClientEntryFromPlatformStates(pk, dynamoDBClient);
          } else {
            updatePurposeIdsInPlatformStateClientEntry();
          }

          // TODO token-generation-states
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
