import { keyToClientJWKKey } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV2,
  fromClientV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { CustomReadModelService } from "./readModelService.js";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  clientJWKKeyReadModelService: CustomReadModelService
): Promise<void> {
  await match(message)
    .with({ type: "ClientKeyAdded" }, async (message) => {
      const client = message.data.client
        ? fromClientV2(message.data.client)
        : undefined;
      if (!client) {
        throw genericInternalError("Client not found in event");
      }

      const key = client?.keys.find((key) => key.kid === message.data.kid);
      if (!key) {
        throw genericInternalError(`Key not found in client: ${client?.id}`);
      }
      await clientJWKKeyReadModelService.upsertClientJWKKey(
        keyToClientJWKKey(key, client.id),
        message.version
      );
    })
    .with({ type: "ClientKeyDeleted" }, async (message) => {
      const client = message.data.client
        ? fromClientV2(message.data.client)
        : undefined;
      if (!client) {
        throw genericInternalError("Client not found in event");
      }

      await clientJWKKeyReadModelService.deleteClientJWKKeyByClientIdAndKid(
        client.id,
        message.data.kid,
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
      {
        type: P.union(
          "ClientAdded",
          "ClientUserAdded",
          "ClientUserDeleted",
          "ClientAdminRemoved",
          "ClientPurposeAdded",
          "ClientPurposeRemoved",
          "ProducerKeychainAdded",
          "ProducerKeychainDeleted",
          "ProducerKeychainKeyAdded",
          "ProducerKeychainKeyDeleted",
          "ProducerKeychainUserAdded",
          "ProducerKeychainUserDeleted",
          "ProducerKeychainEServiceAdded",
          "ProducerKeychainEServiceRemoved"
        ),
      },
      () => Promise.resolve
    )
    .exhaustive();
}
