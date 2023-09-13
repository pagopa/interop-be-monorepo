import { Kafka, KafkaMessage } from "kafkajs";
import { logger } from "pagopa-interop-commons";
import { decodeKafkaMessage } from "./model/models.js";
import { handleMessage } from "./consumerService.js";
import { config } from "./utilities/config.js";

const kafka = new Kafka({
  clientId: config.kafkaClientId,
  brokers: [config.kafkaBrokers],
});

const consumer = kafka.consumer({ groupId: config.kafkaGroupId });
await consumer.connect();

function exitGracefully(): void {
  consumer.disconnect().finally(() => {
    logger.info("Consumer disconnected");
    process.exit(0);
  });
}

process.on("SIGINT", exitGracefully);
process.on("SIGTERM", exitGracefully);

await consumer.subscribe({
  topics: ["catalog.public.event"],
});

async function processMessage(message: KafkaMessage): Promise<void> {
  try {
    await handleMessage(decodeKafkaMessage(message));

    logger.info("Read model was updated");
  } catch (e) {
    logger.error(e);
  }
}

await consumer.run({
  eachMessage: ({ message }) => processMessage(message),
});
