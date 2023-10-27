import { match } from "ts-pattern";
import {
  logger,
  consumerConfig,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { EventEnvelope } from "./model/models.js";
import { fromAgreementV1 } from "./model/converter.js";

const { agreements } = ReadModelRepository.init(consumerConfig());

export async function handleMessage(message: EventEnvelope): Promise<void> {
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
    .exhaustive();
}
