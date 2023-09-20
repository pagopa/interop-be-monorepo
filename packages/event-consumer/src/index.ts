import "dotenv-flow/config.js";

import { Kafka, KafkaMessage } from "kafkajs";
import { logger } from "pagopa-interop-commons";
import { createMechanism } from "@jm18457/kafkajs-msk-iam-authentication-mechanism";
import { decodeKafkaMessage } from "./model/models.js";
import { handleMessage } from "./consumerService.js";
import { config } from "./utilities/config.js";

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
