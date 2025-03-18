import { createJWK, keyToClientJWKKey } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV1,
  fromKeyV1,
  Key,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { CustomReadModelService } from "./readModelService.js";

export async function handleMessageV1(
  message: AuthorizationEventEnvelopeV1,
  clientJWKKeyReadModelService: CustomReadModelService
): Promise<void> {
  await match(message)
    .with({ type: "KeysAdded" }, async (message) => {
      const keysToAdd = message.data.keys
        .map((keyV1) => (keyV1.value ? fromKeyV1(keyV1.value) : undefined))
        .filter((k): k is Key => k !== undefined)
        .filter((k) => {
          const jwk = createJWK(k.encodedPem);
          return jwk.kty !== "EC";
        });
      for (const key of keysToAdd) {
        if (key) {
          await clientJWKKeyReadModelService.upsertClientJWKKey(
            keyToClientJWKKey(key, unsafeBrandId(message.data.clientId)),
            message.version
          );
        }
      }
    })
    .with({ type: "KeyDeleted" }, async (message) => {
      await clientJWKKeyReadModelService.deleteClientJWKKeyByKid(
        unsafeBrandId(message.data.clientId),
        message.data.keyId,
        message.version
      );
    })
    .with({ type: "ClientDeleted" }, async (message) => {
      await clientJWKKeyReadModelService.deleteClientJWKKeysByClientId(
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
