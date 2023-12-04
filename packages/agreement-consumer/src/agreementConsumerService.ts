import { match } from "ts-pattern";
import {
  logger,
  ReadModelRepository,
  ConsumerConfig,
} from "pagopa-interop-commons";
import { EventEnvelope } from "./model/models.js";
import { fromAgreementV1 } from "./model/converter.js";

export async function handleMessage(
  message: EventEnvelope,
  config: ConsumerConfig
): Promise<void> {
  const agreements = ReadModelRepository.init(config).agreements;

  logger.info(message);
  await match(message)
    .with({ type: "AgreementAdded" }, async (msg) => {
      await agreements.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: {
            data: msg.data.agreement
              ? fromAgreementV1(msg.data.agreement)
              : undefined,
            metadata: {
              version: msg.version,
            },
          },
        },
        { upsert: true }
      );
    })
    .with({ type: "AgreementDeleted" }, async (msg) => {
      await agreements.deleteOne({
        "data.id": msg.stream_id,
        "metadata.version": { $lt: msg.version },
      });
    })
    .with({ type: "AgreementUpdated" }, async (msg) => {
      await agreements.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lt: msg.version },
        },
        {
          $set: {
            data: msg.data.agreement
              ? fromAgreementV1(msg.data.agreement)
              : undefined,
            metadata: {
              version: msg.version,
            },
          },
        }
      );
    })
    .exhaustive();
}
