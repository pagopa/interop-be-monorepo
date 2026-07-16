import type { Producer } from "@confluentinc/kafka-javascript/types/kafkajs.js";
import type { KafkaProducerConfig } from "./config/config.js";
import { checkTopicsExist } from "./admin.js";
import { initKafka } from "./kafka.js";
import { errorEventsListener } from "./listeners.js";
import { Logger } from "pagopa-interop-commons";

export async function createProducer(
  topics: string[],
  config: KafkaProducerConfig,
  logger: Logger,
  onShutdown?: () => Promise<void>
): Promise<Producer> {
  logger.debug(`Kafka producer connecting to topics: ${topics}`);

  const kafka = await initKafka(config, logger);

  const producer = kafka.producer({
    "transactional.id": config.kafkaTransactionalId,
  });

  errorEventsListener(producer, logger, onShutdown);

  await producer.connect();
  logger.debug("Kafka producer connected");

  const topicExists = await checkTopicsExist(kafka, topics, logger);
  if (!topicExists) {
    await producer.disconnect();
    throw new Error(`Unable to produce to topics: ${topics}`);
  }

  logger.info(`Kafka producer ready for topics: ${topics}`);

  return producer;
}
