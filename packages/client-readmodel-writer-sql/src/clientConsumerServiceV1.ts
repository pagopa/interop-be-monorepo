import { createJWK } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV1,
  ClientId,
  fromClientV1,
  fromKeyV1,
  genericInternalError,
  Key,
  PurposeId,
  unsafeBrandId,
  UserId,
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
        unsafeBrandId<UserId>(message.data.userId),
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
        unsafeBrandId<UserId>(message.data.userId),
        message.version
      );
    })
    .with({ type: "ClientPurposeAdded" }, async (message) => {
      const purposeId = message.data.statesChain?.purpose?.purposeId;

      if (!purposeId) {
        throw genericInternalError("");
      }
      await readModelService.addPurpose(
        unsafeBrandId<ClientId>(message.data.clientId),
        unsafeBrandId<PurposeId>(purposeId),
        message.version
      );
    })
    .with({ type: "ClientPurposeRemoved" }, async (message) => {
      await readModelService.removePurpose(
        unsafeBrandId<ClientId>(message.data.clientId),
        unsafeBrandId<PurposeId>(message.data.purposeId),
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
        unsafeBrandId<ClientId>(message.data.clientId),
        keysToAdd,
        message.version
      );
    })
    .with({ type: "KeyDeleted" }, async (message) => {
      await readModelService.deleteKey(
        unsafeBrandId<ClientId>(message.data.clientId),
        message.data.keyId,
        message.version
      );
    })
    .with({ type: "ClientDeleted" }, async (message) => {
      await readModelService.deleteClientById(
        unsafeBrandId<ClientId>(message.data.clientId),
        message.version
      );
    })
    .with({ type: "KeyRelationshipToUserMigrated" }, async (message) => {
      // await clients.updateOne(
      //   {
      //     "data.id": message.stream_id,
      //     "metadata.version": { $lte: message.version },
      //   },
      //   {
      //     $set: {
      //       "data.keys.$[key].userId": message.data.userId,
      //       "metadata.version": message.version,
      //     },
      //   },
      //   {
      //     arrayFilters: [
      //       {
      //         "key.kid": message.data.keyId,
      //       },
      //     ],
      //   }
      // );
    })
    .with({ type: "RelationshipAdded" }, { type: "RelationshipRemoved" }, () =>
      Promise.resolve()
    )
    .exhaustive();
}
