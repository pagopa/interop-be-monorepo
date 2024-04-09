/* eslint-disable functional/immutable-data */
import { EachMessagePayload } from "kafkajs";
import {
  logger,
  readModelWriterConfig,
  tenantTopicConfig,
  decodeKafkaMessage,
  getContext,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { TenantEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV2 } from "./tenantConsumerServiceV2.js";
import { handleMessageV1 } from "./tenantConsumerServiceV1.js";

const config = readModelWriterConfig();
const { tenantTopic } = tenantTopicConfig();
const { tenants } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, TenantEvent);
  const ctx = getContext();
  ctx.messageData = {
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
  };
  ctx.correlationId = decodedMessage.correlation_id;

  await match(decodedMessage)
    .with({ event_version: 1 }, (msg) => handleMessageV1(msg))
    .with({ event_version: 2 }, (msg) => handleMessageV2(msg, tenants))
    .exhaustive();
  logger.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [tenantTopic], processMessage);
