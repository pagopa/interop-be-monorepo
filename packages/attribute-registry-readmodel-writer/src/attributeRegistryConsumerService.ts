import { match } from "ts-pattern";
import { AttributeCollection } from "pagopa-interop-commons";
import {
  AttributeEventEnvelope,
  fromAttributeV1,
  toReadModelAttribute,
} from "pagopa-interop-models";

export async function handleMessage(
  message: AttributeEventEnvelope,
  attributes: AttributeCollection
): Promise<void> {
  await match(message)
    .with({ type: "AttributeAdded" }, async (msg) => {
      await attributes.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: {
            data: msg.data.attribute
              ? toReadModelAttribute(fromAttributeV1(msg.data.attribute))
              : undefined,
            metadata: {
              version: msg.version,
            },
          },
        },
        { upsert: true }
      );
    })
    .with({ type: "MaintenanceAttributeDeleted" }, async (msg) => {
      await attributes.deleteOne({
        "data.id": msg.stream_id,
        "metadata.version": { $lte: msg.version },
      });
    })
    .exhaustive();
}
