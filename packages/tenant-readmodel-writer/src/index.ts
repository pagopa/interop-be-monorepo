/* eslint-disable functional/immutable-data */
import { EachMessagePayload } from "kafkajs";
import {
  logger,
  readModelWriterConfig,
  tenantTopicConfig,
  decodeKafkaMessage,
  runWithContext,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { TenantEventV1 } from "pagopa-interop-models";
import { handleMessage } from "./tenantConsumerService.js";

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, TenantEventV1);

  runWithContext(
    {
      messageData: {
        eventType: decodedMessage.type,
        eventVersion: decodedMessage.event_version,
        streamId: decodedMessage.stream_id,
      },
      correlationId: decodedMessage.correlation_id,
    },
    async () => {
      await handleMessage(decodedMessage);
      logger.info(
        `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
      );
    }
  );
}

const config = readModelWriterConfig();
const { tenantTopic } = tenantTopicConfig();
await runConsumer(config, [tenantTopic], processMessage);
