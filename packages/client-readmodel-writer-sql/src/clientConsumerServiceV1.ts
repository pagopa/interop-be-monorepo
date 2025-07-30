import { createJWK } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV1,
  fromClientV1,
  fromKeyV1,
  Key,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ClientWriterService } from "./clientWriterService.js";

export async function handleMessageV1(
  message: AuthorizationEventEnvelopeV1,
  clientWriterService: ClientWriterService
): Promise<void> {
  await match(message)
    .with({ type: "ClientAdded" }, async (message) => {
      const clientV1 = message.data.client;
      if (!clientV1) {
        throw missingKafkaMessageDataError("client", message.type);
      }

      await clientWriterService.upsertClient(
        fromClientV1(clientV1),
        message.version
      );
    })
    .with({ type: "UserAdded" }, async (message) => {
      const clientV1 = message.data.client;
      if (!clientV1) {
        throw missingKafkaMessageDataError("client", message.type);
      }

      await clientWriterService.addUser(
        fromClientV1(clientV1).id,
        unsafeBrandId(message.data.userId),
        message.version
      );
    })
    .with({ type: "UserRemoved" }, async (message) => {
      const clientV1 = message.data.client;
      if (!clientV1) {
        throw missingKafkaMessageDataError("client", message.type);
      }

      await clientWriterService.removeUser(
        fromClientV1(clientV1).id,
        unsafeBrandId(message.data.userId),
        message.version
      );
    })
    .with({ type: "ClientPurposeAdded" }, async (message) => {
      const purposeId = message.data.statesChain?.purpose?.purposeId;
      if (!purposeId) {
        throw missingKafkaMessageDataError("purposeId", message.type);
      }

      await clientWriterService.addPurpose(
        unsafeBrandId(message.data.clientId),
        unsafeBrandId(purposeId),
        message.version
      );
    })
    .with({ type: "ClientPurposeRemoved" }, async (message) => {
      await clientWriterService.removePurpose(
        unsafeBrandId(message.data.clientId),
        unsafeBrandId(message.data.purposeId),
        message.version
      );
    })
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

      await clientWriterService.addKeys(
        unsafeBrandId(message.data.clientId),
        keysToAdd,
        message.version
      );
    })
    .with({ type: "KeyDeleted" }, async (message) => {
      await clientWriterService.deleteKey(
        unsafeBrandId(message.data.clientId),
        message.data.keyId,
        message.version
      );
    })
    .with({ type: "ClientDeleted" }, async (message) => {
      await clientWriterService.deleteClientById(
        unsafeBrandId(message.data.clientId),
        message.version
      );
    })
    .with({ type: "KeyRelationshipToUserMigrated" }, async (message) => {
      await clientWriterService.migrateKeyRelationshipToUser(
        unsafeBrandId(message.data.clientId),
        message.data.keyId,
        unsafeBrandId(message.data.userId),
        message.version
      );
    })
    .with({ type: "RelationshipAdded" }, { type: "RelationshipRemoved" }, () =>
      Promise.resolve()
    )
    .exhaustive();
}
