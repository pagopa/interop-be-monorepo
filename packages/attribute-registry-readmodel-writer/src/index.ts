/* eslint-disable functional/immutable-data */
import { EachMessagePayload } from "kafkajs";
import {
  ReadModelRepository,
  attributeTopicConfig,
  decodeKafkaMessage,
  logger,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import { AttributeEvent } from "pagopa-interop-models";
import { runConsumer } from "kafka-iam-auth";
import { handleMessage } from "./attributeRegistryConsumerService.js";

const config = readModelWriterConfig();
const { attributes } = ReadModelRepository.init(config);
const { attributeTopic } = attributeTopicConfig();

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const msg = decodeKafkaMessage(message, AttributeEvent);

  const loggerInstance = logger({
    serviceName: "attribute-registry-readmodel-writer",
    eventType: msg.type,
    eventVersion: msg.event_version,
    streamId: msg.stream_id,
    correlationId: msg.correlation_id,
  });

  await handleMessage(msg, attributes);
  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}
await runConsumer(config, [attributeTopic], processMessage);
