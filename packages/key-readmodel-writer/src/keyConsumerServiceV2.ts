import { KeyCollection, keyToJWKKey } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV2,
  fromClientV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  keys: KeyCollection
): Promise<void> {
  await match(message)
    .with({ type: "ClientKeyAdded" }, async (message) => {
      const client = message.data.client
        ? fromClientV2(message.data.client)
        : undefined;
      const key = client?.keys.find((key) => key.kid === message.data.kid);
      if (!key) {
        throw Error(`Key not found in client: ${client?.id}`);
      }
      await keys.updateOne(
        {
          "data.kid": message.data.kid,
          "metadata.version": { $lte: message.version },
        },
        {
          $set: {
            data: keyToJWKKey(key),
            metadata: {
              version: message.version,
            },
          },
        },
        { upsert: true }
      );
    })
    .with({ type: "ClientKeyDeleted" }, async (message) => {
      await keys.deleteOne({
        "data.kid": message.data.kid,
        "metadata.version": { $lte: message.version },
      });
    })
    .with({ type: "ClientDeleted" }, async (message) => {
      await keys.deleteMany({
        "data.clientId": message.data.clientId,
        "metadata.version": { $lte: message.version },
      });
    })
    .with(
      { type: "ClientAdded" },
      { type: "ClientUserAdded" },
      { type: "ClientUserDeleted" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
      () => Promise.resolve
    )
    .exhaustive();
}
