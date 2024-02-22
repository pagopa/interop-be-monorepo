import { match } from "ts-pattern";
import {
  logger,
  consumerConfig,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { EServiceEventEnvelopeV2 } from "pagopa-interop-models";
import { fromEServiceV2 } from "./model/converterV2.js";

const { eservices } = ReadModelRepository.init(consumerConfig());

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2
): Promise<void> {
  logger.info(message);

  const eservice = match(message)
    .with({ type: "EServiceCloned" }, (msg) => msg.data.clonedEservice)
    .otherwise((msg) => msg.data.eservice);

  await eservices.updateOne(
    {
      "data.id": message.stream_id,
      "metadata.version": { $lt: message.version },
    },
    {
      $set: {
        data: eservice ? fromEServiceV2(eservice) : undefined,
        metadata: {
          version: message.version,
        },
      },
    },
    { upsert: true }
  );
}
