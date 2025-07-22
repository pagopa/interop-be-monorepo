import {
  createJWK,
  ClientKeyCollection,
  keyToClientJWKKey,
} from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV1,
  fromKeyV1,
  Key,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV1(
  message: AuthorizationEventEnvelopeV1,
  keys: ClientKeyCollection
): Promise<void> {
  await match(message)
    .with({ type: "KeysAdded" }, async (message) => {
      const keysToAdd = message.data.keys
        .map((keyV1) => (keyV1.value ? fromKeyV1(keyV1.value) : undefined))
        .filter((k): k is Key => k !== undefined)
        .filter((k) => {
          const jwk = createJWK({
            pemKeyBase64: k.encodedPem,
            strictCheck: false,
          });
          return jwk.kty !== "EC";
        });
      for (const key of keysToAdd) {
        if (key) {
          await keys.updateOne(
            {
              "data.kid": key.kid,
              "data.clientId": message.data.clientId,
              "metadata.version": { $lte: message.version },
            },
            {
              $set: {
                data: keyToClientJWKKey(
                  key,
                  unsafeBrandId(message.data.clientId)
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
        "data.clientId": message.data.clientId,
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
      { type: "RelationshipAdded" },
      { type: "RelationshipRemoved" },
      { type: "UserAdded" },
      { type: "UserRemoved" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
      { type: "KeyRelationshipToUserMigrated" },
      () => Promise.resolve
    )
    .exhaustive();
}
