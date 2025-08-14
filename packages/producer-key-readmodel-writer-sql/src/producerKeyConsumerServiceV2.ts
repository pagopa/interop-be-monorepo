import { keyToProducerJWKKey } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV2,
  fromProducerKeychainV2,
  genericInternalError,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { ProducerJWKKeyWriterService } from "./producerJWKKeyWriterService.js";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  producerJWKKeyWriterService: ProducerJWKKeyWriterService
): Promise<void> {
  await match(message)
    .with({ type: "ProducerKeychainKeyAdded" }, async (message) => {
      if (!message.data.producerKeychain) {
        throw missingKafkaMessageDataError("producerKeychain", message.type);
      }

      const producerKeychain = fromProducerKeychainV2(
        message.data.producerKeychain
      );

      const key = producerKeychain.keys.find(
        (key) => key.kid === message.data.kid
      );
      if (!key) {
        throw genericInternalError(
          `Key not found in producerKeychain: ${producerKeychain.id}`
        );
      }

      await producerJWKKeyWriterService.upsertProducerJWKKey(
        keyToProducerJWKKey(key, producerKeychain.id),
        message.version
      );
    })
    .with({ type: "ProducerKeychainKeyDeleted" }, async (message) => {
      if (!message.data.producerKeychain) {
        throw missingKafkaMessageDataError("producerKeychain", message.type);
      }

      await producerJWKKeyWriterService.deleteProducerJWKKeyByProducerKeychainAndKid(
        unsafeBrandId(message.data.producerKeychain.id),
        message.data.kid,
        message.version
      );
    })
    .with({ type: "ProducerKeychainDeleted" }, async (message) => {
      await producerJWKKeyWriterService.deleteProducerJWKKeysByProducerKeychainId(
        unsafeBrandId(message.data.producerKeychainId),
        message.version
      );
    })
    .with(
      {
        type: P.union(
          "ClientAdded",
          "ClientDeleted",
          "ClientAdminSet",
          "ClientUserAdded",
          "ClientUserDeleted",
          "ClientAdminRoleRevoked",
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
