import { KafkaMessage } from "kafkajs";
import { consumerConfig, logger } from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { decodeKafkaMessage } from "./model/models.js";
import { handleMessage } from "./agreementConsumerService.js";

const config = consumerConfig();

async function processMessage(message: KafkaMessage): Promise<void> {
  try {
    await handleMessage(decodeKafkaMessage(message));

    logger.info("Read model was updated");
  } catch (e) {
    logger.error(`Error during message handling ${e}`);
  }
}

await runConsumer(config, "event-store.agreement.events", processMessage).catch(
  logger.error
);
