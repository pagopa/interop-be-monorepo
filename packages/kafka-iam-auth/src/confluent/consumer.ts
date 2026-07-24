import type {
  Consumer,
  EachBatchPayload,
  EachMessagePayload,
} from "@confluentinc/kafka-javascript/types/kafkajs.js";

import {
  KafkaBatchConsumerConfig,
  KafkaConsumerConfig,
  Logger,
} from "pagopa-interop-commons";
import { kafkaMessageProcessError } from "pagopa-interop-models";

import { extractBasicMessageInfo } from "../index.js";
import { checkTopicsExist } from "./admin.js";
import { initKafka } from "./kafka.js";
import { errorEventsListener } from "./listeners.js";
import { processExitAndDisconnect } from "./utils/utils.js";

/**
 * Starts a Kafka consumer and processes messages from the provided topics.
 *
 * The consumer connects, verifies the topics exist, subscribes, and then
 * runs `consumerHandler` for each message. Offsets are committed only after
 * successful processing.
 *
 * @param topics - Kafka topics to subscribe to.
 * @param consumerHandler - Function invoked for each consumed message.
 * @param config - Kafka consumer configuration.
 * @param logger - Logger used for consumer events and errors.
 * @param onShutdown - Optional callback invoked on shutdown. Use it to
 * close caller-owned resources (e.g. `() => readmodelPool.end()` for readmodel
 * writers). Consumers without owned resources can omit it.
 * @param onReady - Optional callback invoked once the consumer is connected
 * and subscribed. Receives a `disconnect` function to gracefully stop the consumer.
 */
export async function runConsumer({
  topics,
  consumerHandler,
  config,
  logger,
  serviceName,
  onShutdown,
  onReady,
}: {
  topics: string[];
  consumerHandler: (messagePayload: EachMessagePayload) => Promise<void>;
  config: KafkaConsumerConfig;
  logger: Logger;
  serviceName?: string;
  onShutdown?: () => Promise<void>;
  onReady?: (disconnect: () => Promise<void>) => void;
}) {
  try {
    const consumer = await createConsumer({
      topics,
      config,
      logger,
      onShutdown,
      onReady,
    });

    await consumer.run({
      eachMessage: async (payload: EachMessagePayload): Promise<void> => {
        try {
          await consumerHandler(payload);
          await kafkaCommitMessageOffsets(consumer, payload, logger);
        } catch (e) {
          const messageInfo = extractBasicMessageInfo(payload.message);
          throw kafkaMessageProcessError(
            payload.topic,
            payload.partition,
            {
              ...messageInfo,
              serviceName,
            },
            e
          );
        }
      },
    });
  } catch (e) {
    logger.error(
      `Generic error during consumer initialization. Error: ${JSON.stringify(e)}`
    );
    await processExitAndDisconnect({ logger, onShutdown });
  }
}

/**
 * Starts a Kafka batch consumer and processes batches of messages from the provided topics.
 *
 * The consumer connects, verifies the topics exist, subscribes, and then
 * runs `consumerHandler` for each batch. Offsets are resolved automatically
 * after each batch is successfully processed.
 *
 * @param topics - Kafka topics to subscribe to.
 * @param consumerHandler - Function invoked for each consumed batch.
 * @param config - Kafka consumer configuration.
 * @param logger - Logger used for consumer events and errors.
 * @param onShutdown - Optional callback invoked on shutdown.
 * @param onReady - Optional callback invoked once the consumer is connected
 * and subscribed. Receives a `disconnect` function to gracefully stop the consumer.
 */
export async function runBatchConsumer({
  topics,
  consumerHandler,
  config,
  batchConfig,
  logger,
  serviceName,
  onShutdown,
  onReady,
}: {
  topics: string[];
  consumerHandler: (payload: EachBatchPayload) => Promise<void>;
  config: KafkaConsumerConfig;
  batchConfig: KafkaBatchConsumerConfig;
  logger: Logger;
  serviceName?: string;
  onShutdown?: () => Promise<void>;
  onReady?: (disconnect: () => Promise<void>) => void;
}) {
  try {
    const consumer = await createConsumer({
      topics,
      config,
      logger,
      onShutdown,
      onReady,
      batchConfig,
    });

    await consumer.run({
      eachBatch: async (payload: EachBatchPayload): Promise<void> => {
        try {
          await consumerHandler(payload);
        } catch (e) {
          throw kafkaMessageProcessError(
            payload.batch.topic,
            payload.batch.partition,
            {
              offset: payload.batch.lastOffset().toString(),
              serviceName,
            },
            e
          );
        }
      },
    });
  } catch (e) {
    logger.error(
      `Generic error during batch consumer initialization. Error: ${JSON.stringify(e)}`
    );
    await processExitAndDisconnect({ logger, onShutdown });
  }
}

async function createConsumer({
  topics,
  config,
  logger,
  onShutdown,
  onReady,
  batchConfig,
}: {
  topics: string[];
  config: KafkaConsumerConfig;
  logger: Logger;
  onShutdown?: () => Promise<void>;
  onReady?: (disconnect: () => Promise<void>) => void;
  batchConfig?: KafkaBatchConsumerConfig;
}): Promise<Consumer> {
  logger.debug(`Kafka consumer connecting to topics: ${topics}`);
  const kafka = await initKafka(config, logger);

  const consumer = kafka.consumer({
    "auto.offset.reset": config.topicStartingOffset,
    "enable.auto.commit": false,
    "group.id": config.kafkaGroupId,
    "retry.backoff.max.ms": 3000,
    ...(batchConfig && {
      "fetch.min.bytes": batchConfig.minBytes,
      "fetch.max.bytes": batchConfig.maxBytes,
      "fetch.wait.max.ms": batchConfig.maxWaitKafkaBatchMillis,
      "session.timeout.ms": batchConfig.sessionTimeoutMillis,
    }),
  });

  errorEventsListener(consumer, logger, onShutdown);

  await consumer.connect();
  logger.debug("Kafka consumer connected");

  const topicExists = await checkTopicsExist(kafka, topics, logger);
  if (!topicExists) {
    await processExitAndDisconnect({ logger, onShutdown });
  }

  await consumer.subscribe({ topics });
  logger.info(`Kafka subscribed to topics: ${topics}`);

  onReady?.(() => consumer.disconnect());

  return consumer;
}

async function kafkaCommitMessageOffsets(
  consumer: Consumer,
  payload: EachMessagePayload,
  logger: Logger
): Promise<void> {
  const { message, partition, topic } = payload;
  await consumer.commitOffsets([
    { offset: (Number(message.offset) + 1).toString(), partition, topic },
  ]);

  logger.debug(`Topic message offset ${Number(message.offset) + 1} committed`);
}
