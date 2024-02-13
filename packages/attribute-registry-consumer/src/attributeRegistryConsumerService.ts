import { match } from "ts-pattern";
import { logger, AttributeCollection } from "pagopa-interop-commons";
import { EventEnvelope } from "./model/models.js";
import { fromAttributeV1 } from "./model/converter.js";

export async function handleMessage(
  message: EventEnvelope,
  attributes: AttributeCollection
): Promise<void> {
  logger.info(message);
  await match(message)
    .with({ type: "AttributeAdded" }, async (msg) => {
      await attributes.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: {
            data: msg.data.attribute
              ? fromAttributeV1(msg.data.attribute)
              : undefined,
            metadata: {
              version: msg.version,
            },
          },
        },
        { upsert: true }
      );
    })
    .with({ type: "AttributeDeleted" }, async (msg) => {
      await attributes.deleteOne({
        "data.id": msg.stream_id,
        "metadata.version": { $lt: msg.version },
      });
    })
    .exhaustive();
}
