import { KeyCollection } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV1,
  fromKeyV1,
  toReadModelKey,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV1(
  message: AuthorizationEventEnvelopeV1,
  keys: KeyCollection
): Promise<void> {
  await match(message)
    .with({ type: "KeysAdded" }, async (message) => {
      const keysToAdd = message.data.keys.map((keyEntry) => keyEntry.value);

      for (const key of keysToAdd) {
        if (key) {
          await keys.updateOne(
            {
              "data.kid": key.kid,
              "metadata.version": { $lt: message.version },
            },
            {
              $set: {
                data: toReadModelKey(fromKeyV1(key)),
                metadata: {
                  version: message.version,
                },
              },
            },
            { upsert: true }
          );
        }
        await Promise.resolve();
      }
    })
    .with({ type: "KeyDeleted" }, async (message) => {
      await keys.deleteOne({
        "data.kid": message.data.keyId,
        "metadata.version": { $lt: message.version },
      });
    })
    .with({ type: "KeyRelationshipToUserMigrated" }, async (message) => {
      const kid = message.data.keyId;
      const userId = message.data.userId;
      await keys.updateOne(
        {
          "data.kid": kid,
          "metadata.version": { $lt: message.version },
        },
        { $set: { "data.userId": userId } },
        { upsert: true }
      );
    })
    .with(
      { type: "ClientAdded" },
      { type: "ClientDeleted" },
      { type: "RelationshipAdded" },
      { type: "RelationshipRemoved" },
      { type: "UserAdded" },
      { type: "UserRemoved" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
      () => Promise.resolve
    )
    .exhaustive();
}
