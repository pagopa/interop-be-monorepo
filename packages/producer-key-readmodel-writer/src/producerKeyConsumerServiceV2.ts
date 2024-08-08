import {
  ProducerKeyCollection,
  keyToProducerJWKKey,
} from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV2,
  fromProducerKeychainV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  keys: ProducerKeyCollection
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
        throw Error(
          `Key not found in producerKeychain: ${producerKeychain?.id}`
        );
      }
      const producerKeychainId = producerKeychain?.id;
      if (!producerKeychainId) {
        throw Error("ProducerKeychainId not found");
      }

      await keys.updateOne(
        {
          "data.kid": message.data.kid,
          "metadata.version": { $lte: message.version },
        },
        {
          $set: {
            data: keyToProducerJWKKey(key, producerKeychainId),
            metadata: {
              version: message.version,
            },
          },
        },
        { upsert: true }
      );
    })
    .with({ type: "ProducerKeychainKeyDeleted" }, async (message) => {
      await keys.deleteOne({
        "data.kid": message.data.kid,
        "metadata.version": { $lte: message.version },
      });
    })
    .with({ type: "ProducerKeychainDeleted" }, async (message) => {
      await keys.deleteMany({
        "data.producerKeychainId": message.data.producerKeychainId,
        "metadata.version": { $lte: message.version },
      });
    })
    .with(
      { type: "ClientAdded" },
      { type: "ClientDeleted" },
      { type: "ClientUserAdded" },
      { type: "ClientUserDeleted" },
      { type: "ClientKeyAdded" },
      { type: "ClientKeyDeleted" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
      { type: "ProducerKeychainAdded" },
      { type: "ProducerKeychainUserAdded" },
      { type: "ProducerKeychainUserDeleted" },
      { type: "ProducerKeychainEServiceAdded" },
      { type: "ProducerKeychainEServiceRemoved" },
      () => Promise.resolve
    )
    .exhaustive();
}
