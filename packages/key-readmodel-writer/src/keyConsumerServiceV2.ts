import { KeyCollection } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV2,
  fromClientV2,
  toReadModelClient,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  keys: KeyCollection
): Promise<void> {
  await match(message)
    .with({ type: "ClientKeyAdded" }, async (message) => {
      const client = message.data.client
        ? toReadModelClient(fromClientV2(message.data.client))
        : undefined;

      const key = client?.keys.find((key) => key.kid === message.data.kid);

      await keys.updateOne(
        {
          "data.kid": message.data.kid,
          "metadata.version": { $lt: message.version },
        },
        {
          $set: {
            data: key,
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
        "metadata.version": { $lt: message.version },
      });
    })
    .with({ type: "ClientDeleted" }, async (message) => {
      const keysToRemove = message.data.client?.keys;
      await keys.deleteMany({
        "data.kid": { $in: keysToRemove?.map((key) => key.kid) },
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
