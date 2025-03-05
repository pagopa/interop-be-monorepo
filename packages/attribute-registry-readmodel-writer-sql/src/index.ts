import { EachMessagePayload } from "kafkajs";
import { decodeKafkaMessage, logger } from "pagopa-interop-commons";
import {
  AttributeEvent,
  CorrelationId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { runConsumer } from "kafka-iam-auth";
import {
  makeDrizzleConnection,
  attributeReadModelServiceBuilderSQL,
} from "pagopa-interop-readmodel";
import { handleMessage } from "./attributeRegistryConsumerService.js";
import { config } from "./config/config.js";

const attributeReadModelService = attributeReadModelServiceBuilderSQL(
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
    correlationId: msg.correlation_id
      ? unsafeBrandId<CorrelationId>(msg.correlation_id)
      : generateId<CorrelationId>(),
  });

  await handleMessage(msg, attributeReadModelService);
  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.attributeTopic], processMessage);
