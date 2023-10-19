import { Kafka, KafkaMessage } from "kafkajs";
import { logger, consumerConfig } from "pagopa-interop-commons";
import { createMechanism } from "@jm18457/kafkajs-msk-iam-authentication-mechanism";
import { decodeKafkaMessage } from "./model/models.js";
import { handleMessage } from "./consumerService.js";

const kafkaConfig = consumerConfig.kafkaDisableAwsIamAuth
  ? {
      clientId: consumerConfig.kafkaClientId,
      brokers: [consumerConfig.kafkaBrokers],
      ssl: false,
    }
  : {
      clientId: consumerConfig.kafkaClientId,
      brokers: [consumerConfig.kafkaBrokers],
      ssl: true,
      sasl: createMechanism({ region: consumerConfig.awsRegion }),
    };

const kafka = new Kafka(kafkaConfig);
const consumer = kafka.consumer({ groupId: consumerConfig.kafkaGroupId });
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
  topics: ["event-store.catalog.events"],
  fromBeginning: true,
});

async function processMessage(message: KafkaMessage): Promise<void> {
  try {
    await handleMessage(decodeKafkaMessage(message));

    logger.info("Read model was updated");
  } catch (e) {
    logger.error(`Error during message handling ${e}`);
  }
}

await consumer.run({
  eachMessage: ({ message }) => processMessage(message),
});
