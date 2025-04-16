import { ClientCollection } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV2,
  fromClientV2,
  toReadModelClient,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  clients: ClientCollection
): Promise<void> {
  await match(message)
    .with(
      {
        type: P.union(
          "ClientAdded",
          "ClientKeyAdded",
          "ClientKeyDeleted",
          "ClientUserAdded",
          "ClientUserDeleted",
          "ClientAdminRemoved",
          "ClientPurposeAdded",
          "ClientPurposeRemoved"
        ),
      },
      async (message) => {
        const client = message.data.client;
        await clients.updateOne(
          {
            "data.id": message.stream_id,
            "metadata.version": { $lte: message.version },
          },
          {
            $set: {
              data: client
                ? toReadModelClient(fromClientV2(client))
                : undefined,
              metadata: {
                version: message.version,
              },
            },
          },
          { upsert: true }
        );
      }
    )
    .with({ type: "ClientDeleted" }, async (message) => {
      await clients.deleteOne({
        "data.id": message.stream_id,
        "metadata.version": { $lte: message.version },
      });
    })
    .with(
      {
        type: P.union(
          "ProducerKeychainAdded",
          "ProducerKeychainDeleted",
          "ProducerKeychainKeyAdded",
          "ProducerKeychainKeyDeleted",
          "ProducerKeychainUserAdded",
          "ProducerKeychainUserDeleted",
          "ProducerKeychainEServiceAdded",
          "ProducerKeychainEServiceRemoved"
        ),
      },
      () => Promise.resolve
    )
    .exhaustive();
}
