import { ClientCollection } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV2,
  fromClientV2,
  toReadModelClient,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  clients: ClientCollection
): Promise<void> {
  const client = message.data.client;

  await match(message)
    .with(
      { type: "ClientAdded" },
      { type: "ClientKeyAdded" },
      { type: "ClientKeyDeleted" },
      { type: "ClientUserAdded" },
      { type: "ClientUserDeleted" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
      async (message) => {
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
    .exhaustive();
}
