import {
  AuthorizationEventEnvelopeV2,
  fromProducerKeychainV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { ProducerKeychainReadModelService } from "pagopa-interop-readmodel";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  producerKeychainReadModelService: ProducerKeychainReadModelService
): Promise<void> {
  await match(message)
    .with(
      { type: "ProducerKeychainAdded" },
      { type: "ProducerKeychainKeyAdded" },
      { type: "ProducerKeychainKeyDeleted" },
      { type: "ProducerKeychainUserAdded" },
      { type: "ProducerKeychainUserDeleted" },
      { type: "ProducerKeychainEServiceAdded" },
      { type: "ProducerKeychainEServiceRemoved" },
      async (message) => {
        const producerKeychain = message.data.producerKeychain;
        if (!producerKeychain) {
          throw genericInternalError(
            "ProducerKeychainAdded message without producerKeychain"
          );
        }

        await producerKeychainReadModelService.upsertProducerKeychain(
          fromProducerKeychainV2(producerKeychain),
          message.version
        );
      }
    )
    .with({ type: "ProducerKeychainDeleted" }, async (message) => {
      await producerKeychainReadModelService.deleteProducerKeychainById(
        unsafeBrandId(message.data.producerKeychainId),
        message.version
      );
    })
    .with(
      { type: "ClientAdded" },
      { type: "ClientDeleted" },
      { type: "ClientKeyAdded" },
      { type: "ClientKeyDeleted" },
      { type: "ClientUserAdded" },
      { type: "ClientUserDeleted" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
      () => Promise.resolve
    )
    .exhaustive();
}
