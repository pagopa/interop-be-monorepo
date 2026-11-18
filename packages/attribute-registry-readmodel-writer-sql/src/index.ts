import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import { decodeKafkaMessage, logger } from "pagopa-interop-commons";
import {
  AttributeEvent,
  CorrelationId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { match } from "ts-pattern";

import { handleMessage } from "./attributeRegistryConsumerService.js";
import { attributeWriterServiceBuilder } from "./attributeWriterService.js";
import { config } from "./config/config.js";
import { handleMessageV2 } from "./consumerServiceV2.js";

const attributeWriterService = attributeWriterServiceBuilder(
  makeDrizzleConnection(config)
);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const msg = decodeKafkaMessage(message, AttributeEvent);

  const loggerInstance = logger({
    serviceName: "attribute-registry-readmodel-writer-sql",
    eventType: msg.type,
    eventVersion: msg.event_version,
    streamId: msg.stream_id,
    streamVersion: msg.version,
    correlationId: msg.correlation_id
      ? unsafeBrandId<CorrelationId>(msg.correlation_id)
      : generateId<CorrelationId>(),
  });

  await match(msg)
    .with({ event_version: 1 }, (msg) =>
      handleMessage(msg, attributeWriterService)
    )
    .with({ event_version: 2 }, (msg) =>
      handleMessageV2(msg, attributeWriterService)
    )
    .exhaustive();
  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(
  config,
  [config.attributeTopic],
  processMessage,
  "attribute-registry-readmodel-writer-sql"
);
