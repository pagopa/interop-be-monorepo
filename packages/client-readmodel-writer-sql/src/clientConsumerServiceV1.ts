import { createJWK } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV1,
  fromClientV1,
  fromKeyV1,
  genericInternalError,
  Key,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ReadModelService } from "./readModelService.js";

export async function handleMessageV1(
  message: AuthorizationEventEnvelopeV1,
  readModelService: ReadModelService
): Promise<void> {
  await match(message)
    .with({ type: "ClientAdded" }, async (message) => {
      const clientV1 = message.data.client;

      if (!clientV1) {
        throw genericInternalError("client can't be missing in event message");
      }

      await readModelService.upsertClient(
        fromClientV1(clientV1),
        message.version
      );
    })
    .with({ type: "UserAdded" }, async (message) => {
      const clientV1 = message.data.client;

      if (!clientV1) {
        throw genericInternalError("client can't be missing in event message");
      }
      await readModelService.addUser(
        fromClientV1(clientV1).id,
        unsafeBrandId(message.data.userId),
        message.version
      );
    })
    .with({ type: "UserRemoved" }, async (message) => {
      const clientV1 = message.data.client;
      if (!clientV1) {
        throw genericInternalError("client can't be missing in event message");
      }
      await readModelService.removeUser(
        fromClientV1(clientV1).id,
        unsafeBrandId(message.data.userId),
        message.version
      );
    })
    .with({ type: "ClientPurposeAdded" }, async (message) => {
      const purposeId = message.data.statesChain?.purpose?.purposeId;

      if (!purposeId) {
        throw genericInternalError("");
      }
      await readModelService.addPurpose(
        unsafeBrandId(message.data.clientId),
        unsafeBrandId(purposeId),
        message.version
      );
    })
    .with({ type: "ClientPurposeRemoved" }, async (message) => {
      await readModelService.removePurpose(
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
          const jwk = createJWK(k.encodedPem);
          return jwk.kty !== "EC";
        });

      await readModelService.addKeys(
        unsafeBrandId(message.data.clientId),
        keysToAdd,
        message.version
      );
    })
    .with({ type: "KeyDeleted" }, async (message) => {
      await readModelService.deleteKey(
        unsafeBrandId(message.data.clientId),
        message.data.keyId,
        message.version
      );
    })
    .with({ type: "ClientDeleted" }, async (message) => {
      await readModelService.deleteClientById(
        unsafeBrandId(message.data.clientId),
        message.version
      );
    })
    .with({ type: "KeyRelationshipToUserMigrated" }, async (message) => {
      await readModelService.migrateKeyRelationshipToUser(
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
