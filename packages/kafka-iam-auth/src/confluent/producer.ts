import type { Producer } from "@confluentinc/kafka-javascript/types/kafkajs.js";

import { KafkaProducerConfig, Logger } from "pagopa-interop-commons";

import { checkTopicsExist } from "./admin.js";
import { initKafka } from "./kafka.js";
import { errorEventsListener } from "./listeners.js";

export async function createProducer({
  topics,
  config,
  logger,
  onShutdown,
}: {
  topics: string[];
  config: KafkaProducerConfig;
  logger: Logger;
  onShutdown?: () => Promise<void>;
}): Promise<Producer> {
  logger.debug(`Kafka producer connecting to topics: ${topics}`);

  const kafka = await initKafka(
    {
      kafkaBrokers: config.producerKafkaBrokers,
      kafkaClientId: config.producerKafkaClientId,
      kafkaLogLevel: config.producerKafkaLogLevel,
      mskAuth: config.mskAuth,
      kafkaBrokerConnectionString: config.producerKafkaBrokerConnectionString,
      awsRegion: config.awsRegion,
      kafkaDisableAwsIamAuth: config.producerKafkaDisableAwsIamAuth,
      kafkaReauthenticationThreshold:
        config.producerKafkaReauthenticationThreshold,
      featureFlagConfluentKafka: config.featureFlagConfluentKafka,
    },
    logger
  );

  const producer = kafka.producer({
    "transactional.id": config.producerKafkaTransactionalId,
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
