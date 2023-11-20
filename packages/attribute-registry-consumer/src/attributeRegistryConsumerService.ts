import { match } from "ts-pattern";
import {
  logger,
  ReadModelRepository,
  ConsumerConfig,
} from "pagopa-interop-commons";
import { EventEnvelope } from "./model/models.js";
import { fromAttributeV1 } from "./model/converter.js";

export async function handleMessage(
  message: EventEnvelope,
  config: ConsumerConfig
): Promise<void> {
  const { attributes } = ReadModelRepository.init(config);

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
    .exhaustive();
}
