/* eslint-disable functional/immutable-data */
import { EachMessagePayload, Kafka } from "kafkajs";
import {
  ReadModelRepository,
  decodeKafkaMessage,
  genericLogger,
  logger,
} from "pagopa-interop-commons";
import { createMechanism } from "@jm18457/kafkajs-msk-iam-authentication-mechanism";
import { AttributeEvent } from "pagopa-interop-models";
import { runConsumer } from "kafka-iam-auth";
import { handleMessage } from "./attributeRegistryConsumerService.js";
import { config } from "./utilities/config.js";

const { attributes } = ReadModelRepository.init(config);

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
    genericLogger.info("Consumer disconnected");
    process.exit(0);
  });
}

process.on("SIGINT", exitGracefully);
process.on("SIGTERM", exitGracefully);

await consumer.subscribe({
  topics: [config.attributeTopic],
  fromBeginning: true,
});

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const msg = decodeKafkaMessage(message, AttributeEvent);

  const loggerInstance = logger({
    serviceName: "attribute-registry-readmodel-writer",
    eventType: msg.type,
    eventVersion: msg.event_version,
    streamId: msg.stream_id,
    correlationId: msg.correlation_id,
  });

  await handleMessage(msg, attributes);
  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}
await runConsumer(config, [config.attributeTopic], processMessage);
