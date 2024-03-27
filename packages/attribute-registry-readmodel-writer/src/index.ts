import { Kafka, KafkaMessage } from "kafkajs";
import {
  ReadModelRepository,
  attributeTopicConfig,
  decodeKafkaMessage,
  logger,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import { createMechanism } from "@jm18457/kafkajs-msk-iam-authentication-mechanism";
import { AttributeEvent } from "pagopa-interop-models";
import { handleMessage } from "./attributeRegistryConsumerService.js";

const config = readModelWriterConfig();
const { attributes } = ReadModelRepository.init(config);
const { attributeTopic } = attributeTopicConfig();

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
  topics: [attributeTopic],
  fromBeginning: true,
});

async function processMessage(message: KafkaMessage): Promise<void> {
  try {
    await handleMessage(
      decodeKafkaMessage(message, AttributeEvent),
      attributes
    );

    logger.info("Read model was updated");
  } catch (e) {
    logger.error(`Error during message handling ${e}`);
  }
}

await consumer.run({
  eachMessage: ({ message }) => processMessage(message),
});
