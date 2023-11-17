import { KafkaMessage } from "kafkajs";
import { logger, consumerConfig } from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { decodeKafkaMessage } from "./model/models.js";
import { handleMessage } from "./consumerService.js";

async function processMessage(message: KafkaMessage): Promise<void> {
  try {
    await handleMessage(decodeKafkaMessage(message));
    logger.info("Read model was updated");
  } catch (e) {
    logger.error(`Error during message handling ${e}`);
  }
}

const config = consumerConfig();
await runConsumer(config, ["event-store.tenant.events"], processMessage).catch(
  logger.error
);
