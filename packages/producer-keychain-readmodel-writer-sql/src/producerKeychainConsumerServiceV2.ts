import {
  AuthorizationEventEnvelopeV2,
  fromProducerKeychainV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { ProducerKeychainReadModelService } from "pagopa-interop-readmodel";
import { match, P } from "ts-pattern";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  producerKeychainReadModelService: ProducerKeychainReadModelService
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
      {
        type: P.union(
          "ClientAdded",
          "ClientDeleted",
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
