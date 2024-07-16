import { KeyCollection } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV1,
  fromKeyV1,
  toReadModelKey,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { fromKeyToReadModelJWKKey } from "./../../commons/src/auth/converters.js";

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
              "metadata.version": { $lte: message.version },
            },
            {
              $set: {
                data: fromKeyToReadModelJWKKey(
                  toReadModelKey(
                    fromKeyV1(key, unsafeBrandId(message.data.clientId))
                  )
                ),
                metadata: {
                  version: message.version,
                },
              },
            },
            { upsert: true }
          );
        }
      }
    })
    .with({ type: "KeyDeleted" }, async (message) => {
      await keys.deleteOne({
        "data.kid": message.data.keyId,
        "metadata.version": { $lte: message.version },
      });
    })
    .with({ type: "KeyRelationshipToUserMigrated" }, async () =>
      Promise.resolve()
    )
    .with({ type: "ClientDeleted" }, async (message) => {
      await keys.deleteMany({
        "data.clientId": message.data.clientId,
        "metadata.version": { $lte: message.version },
      });
    })
    .with(
      { type: "ClientAdded" },
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
