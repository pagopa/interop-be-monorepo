import { ProducerKeychainCollection } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV2,
  fromProducerKeychainV2,
  toReadModelProducerKeychain,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  producerKeychains: ProducerKeychainCollection
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
        await producerKeychains.updateOne(
          {
            "data.id": message.stream_id,
            "metadata.version": { $lte: message.version },
          },
          {
            $set: {
              data: producerKeychain
                ? toReadModelProducerKeychain(
                    fromProducerKeychainV2(producerKeychain)
                  )
                : undefined,
              metadata: {
                version: message.version,
              },
            },
          },
          { upsert: true }
        );
      }
    )
    .with({ type: "ProducerKeychainDeleted" }, async (message) => {
      await producerKeychains.deleteOne({
        "data.id": message.stream_id,
        "metadata.version": { $lte: message.version },
      });
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
