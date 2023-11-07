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

function exitGracefully(): void {
  logger.info("Consumer exiting...");
  process.exit(0);
}
process.on("SIGINT", exitGracefully);
process.on("SIGTERM", exitGracefully);

const config = consumerConfig();

runConsumer(config, "event-store.catalog.events", processMessage).catch(
  logger.error
);
