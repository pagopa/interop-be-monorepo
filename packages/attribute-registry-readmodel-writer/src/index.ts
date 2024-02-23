import { Kafka, KafkaMessage } from "kafkajs";
import {
  consumerConfig,
  decodeKafkaMessage,
  logger,
} from "pagopa-interop-commons";
import { createMechanism } from "@jm18457/kafkajs-msk-iam-authentication-mechanism";
import { AttributeEvent } from "pagopa-interop-models";
import { handleMessage } from "./attributeRegistryConsumerService.js";

const config = consumerConfig();
const kafkaConfig = config.kafkaDisableAwsIamAuth
  ? {
      clientId: config.kafkaClientId,
      brokers: [config.kafkaBrokers],
      ssl: false,
    }
  : {
      clientId: config.kafkaClientId,
      brokers: [config.kafkaBrokers],
      ssl: true,
      sasl: createMechanism({ region: config.awsRegion }),
    };

const kafka = new Kafka(kafkaConfig);
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
  topics: ["event-store.attribute.events"],
  fromBeginning: true,
});

async function processMessage(message: KafkaMessage): Promise<void> {
  try {
    await handleMessage(decodeKafkaMessage(message, AttributeEvent));

    logger.info("Read model was updated");
  } catch (e) {
    logger.error(`Error during message handling ${e}`);
  }
}

await consumer.run({
  eachMessage: ({ message }) => processMessage(message),
});
