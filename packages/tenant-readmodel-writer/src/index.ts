/* eslint-disable functional/immutable-data */
import { EachMessagePayload } from "kafkajs";
import {
  logger,
  readModelWriterConfig,
  tenantTopicConfig,
  decodeKafkaMessage,
  getContext,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { TenantEventV1 } from "pagopa-interop-models";
import { handleMessage } from "./tenantConsumerService.js";

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, TenantEventV1);

  const ctx = getContext();
  ctx.messageData = {
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
  };
  ctx.correlationId = decodedMessage.correlation_id;

  await handleMessage(decodedMessage);
  logger.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

const config = readModelWriterConfig();
const { tenantTopic } = tenantTopicConfig();
await runConsumer(config, [tenantTopic], processMessage);
