import {
  AuthorizationEventEnvelopeV2,
  fromProducerKeychainV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { ProducerKeychainWriterService } from "./producerKeychainWriterService.js";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  producerKeychainWriterService: ProducerKeychainWriterService
): Promise<void> {
  await match(message)
    .with(
      {
        type: P.union(
          "ProducerKeychainAdded",
          "ProducerKeychainKeyAdded",
          "ProducerKeychainKeyDeleted",
          "ProducerKeychainUserAdded",
          "ProducerKeychainUserDeleted",
          "ProducerKeychainEServiceAdded",
          "ProducerKeychainEServiceRemoved"
        ),
      },
      async (message) => {
        const producerKeychain = message.data.producerKeychain;
        if (!producerKeychain) {
          throw missingKafkaMessageDataError("producerKeychain", message.type);
        }

        await producerKeychainWriterService.upsertProducerKeychain(
          fromProducerKeychainV2(producerKeychain),
          message.version
        );
      }
    )
    .with({ type: "ProducerKeychainDeleted" }, async (message) => {
      await producerKeychainWriterService.deleteProducerKeychainById(
        unsafeBrandId(message.data.producerKeychainId),
        message.version
      );
    })
    .with(
      {
        type: P.union(
          "ClientAdded",
          "ClientDeleted",
          "ClientAdminRoleRevoked",
          "ClientAdminSet",
          "ClientAdminRemoved",
          "ClientKeyAdded",
          "ClientKeyDeleted",
          "ClientUserAdded",
          "ClientUserDeleted",
          "ClientPurposeAdded",
          "ClientPurposeRemoved"
        ),
      },
      () => Promise.resolve
    )
    .exhaustive();
}
