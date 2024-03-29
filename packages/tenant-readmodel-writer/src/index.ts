import { EachMessagePayload } from "kafkajs";
import {
  logger,
  readModelWriterConfig,
  tenantTopicConfig,
  decodeKafkaMessage,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { TenantEvent } from "pagopa-interop-models";
import { handleMessage } from "./tenantConsumerService.js";

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  try {
    await handleMessage(decodeKafkaMessage(message, TenantEvent));
    logger.info(
      `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
    );
  } catch (e) {
    logger.error(
      `Error during message handling. Partition number: ${partition}. Offset: ${message.offset}, ${e}`
    );
  }
}

const config = readModelWriterConfig();
const { tenantTopic } = tenantTopicConfig();
await runConsumer(config, [tenantTopic], processMessage).catch(logger.error);
