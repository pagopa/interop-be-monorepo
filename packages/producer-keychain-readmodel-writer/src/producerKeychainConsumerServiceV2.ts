import { ProducerKeychainCollection } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV2,
  fromProducerKeychainV2,
  toReadModelProducerKeychain,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  producerKeychains: ProducerKeychainCollection
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
