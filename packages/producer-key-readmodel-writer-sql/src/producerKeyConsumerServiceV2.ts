import { keyToProducerJWKKey } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV2,
  fromProducerKeychainV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { CustomReadModelService } from "./readModelService.js";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  producerJWKKeyReadModelService: CustomReadModelService
): Promise<void> {
  await match(message)
    .with({ type: "ProducerKeychainKeyAdded" }, async (message) => {
      const producerKeychain = message.data.producerKeychain
        ? fromProducerKeychainV2(message.data.producerKeychain)
        : undefined;
      const key = producerKeychain?.keys.find(
        (key) => key.kid === message.data.kid
      );
      if (!key) {
        throw genericInternalError(
          `Key not found in producerKeychain: ${producerKeychain?.id}`
        );
      }
      const producerKeychainId = producerKeychain?.id;
      if (!producerKeychainId) {
        throw genericInternalError("ProducerKeychainId not found");
      }

      await producerJWKKeyReadModelService.upsertProducerJWKKey(
        keyToProducerJWKKey(key, producerKeychainId),
        message.version
      );
    })
    .with({ type: "ProducerKeychainKeyDeleted" }, async (message) => {
      if (!message.data.producerKeychain) {
        throw genericInternalError("ProducerKeychain not found in message");
      }

      await producerJWKKeyReadModelService.deleteProducerJWKKeyByProducerKeychainAndKid(
        unsafeBrandId(message.data.producerKeychain.id),
        message.data.kid,
        message.version
      );
    })
    .with({ type: "ProducerKeychainDeleted" }, async (message) => {
      await producerJWKKeyReadModelService.deleteProducerJWKKeysByProducerKeychainId(
        unsafeBrandId(message.data.producerKeychainId),
        message.version
      );
    })
    .with(
      {
        type: P.union(
          "ClientAdded",
          "ClientDeleted",
          "ClientUserAdded",
          "ClientUserDeleted",
          "ClientAdminRemoved",
          "ClientKeyAdded",
          "ClientKeyDeleted",
          "ClientPurposeAdded",
          "ClientPurposeRemoved",
          "ProducerKeychainAdded",
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
