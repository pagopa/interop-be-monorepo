import { createJWK, keyToClientJWKKey } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV1,
  fromKeyV1,
  Key,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ClientJWKKeyWriterService } from "./clientJWKKeyWriterService.js";

export async function handleMessageV1(
  message: AuthorizationEventEnvelopeV1,
  clientJWKKeyWriterService: ClientJWKKeyWriterService
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
          await clientJWKKeyWriterService.upsertClientJWKKey(
            keyToClientJWKKey(key, unsafeBrandId(message.data.clientId)),
            message.version
          );
        }
      }
    })
    .with({ type: "KeyDeleted" }, async (message) => {
      await clientJWKKeyWriterService.deleteClientJWKKeyByClientIdAndKid(
        unsafeBrandId(message.data.clientId),
        message.data.keyId,
        message.version
      );
    })
    .with({ type: "ClientDeleted" }, async (message) => {
      await clientJWKKeyWriterService.deleteClientJWKKeysByClientId(
        unsafeBrandId(message.data.clientId),
        message.version
      );
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
