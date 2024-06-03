import { KeyCollection } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV2,
  fromClientV2,
  toReadModelClient,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  keys: KeyCollection
): Promise<void> {
  await match(message)
    .with({ type: "ClientKeyAdded" }, async (message) => {
      const client = message.data.client
        ? toReadModelClient(fromClientV2(message.data.client))
        : undefined;

      const key = client?.keys.find((key) => key.kid === message.data.kid);

      /*
      to do: double-check version retrieval.
      the implementation below retrieves the version number by reading the existing key (if any) in readmodel.
      
      Alternative implementation: we could use the version number of the client, but this means that the key will "skip" some versions.
      For example, if a key is created at the 7th update of the client, this means that the key will be inserted in the keys collection with version 7
      */
      const version =
        (
          await keys.findOne({
            "data.id": message.data.kid,
          })
        )?.metadata.version || 0;

      await keys.updateOne(
        {
          "data.id": message.data.kid,
          "metadata.version": { $lt: version },
        },
        {
          $set: {
            data: key,
            metadata: {
              version,
            },
          },
        },
        { upsert: true }
      );
    })
    .with({ type: "ClientKeyDeleted" }, async (message) => {
      const version =
        (
          await keys.findOne({
            "data.id": message.data.kid,
          })
        )?.metadata.version || 0;

      await keys.deleteOne({
        "data.kid": message.data.kid,
        "metadata.version": { $lt: version + 1 },
      });
    })
    .with(
      { type: "ClientAdded" },
      { type: "ClientDeleted" },
      { type: "ClientUserAdded" },
      { type: "ClientUserDeleted" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
      () => Promise.resolve
    )
    .exhaustive();
}
