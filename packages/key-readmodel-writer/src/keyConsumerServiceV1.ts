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
          const version =
            (
              await keys.findOne({
                "data.kid": key.kid,
              })
            )?.metadata.version || 0;

          await keys.updateOne(
            {
              "data.kid": key.kid,
              "metadata.version": { $lt: version },
            },
            {
              $set: {
                data: toReadModelKey(fromKeyV1(key)),
                metadata: {
                  version,
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
      const version =
        (
          await keys.findOne({
            "data.kid": message.data.keyId,
          })
        )?.metadata.version || 0;

      await keys.deleteOne({
        "data.kid": message.data.keyId,
        "metadata.version": { $lt: version + 1 },
      });
    })
    .with(
      { type: "KeyRelationshipToUserMigrated" },
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
