import { match } from "ts-pattern";
import { EServiceCollection, logger } from "pagopa-interop-commons";
import { EServiceEventEnvelopeV2, fromEServiceV2 } from "pagopa-interop-models";

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2,
  eservices: EServiceCollection
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
