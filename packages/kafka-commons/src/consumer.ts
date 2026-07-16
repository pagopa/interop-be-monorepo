import type {
  Consumer,
  EachBatchPayload,
  EachMessagePayload,
} from "@confluentinc/kafka-javascript/types/kafkajs.js";
import type { KafkaConsumerConfig } from "./config/config.js";
import { checkTopicsExist } from "./admin.js";
import { initKafka } from "./kafka.js";
import { errorEventsListener } from "./listeners.js";
import {
  extractBasicMessageInfo,
  processExitAndDisconnect,
} from "./utils/utils.js";
import { KafkaBatchConsumerConfig, Logger } from "pagopa-interop-commons";
import {
  genericInternalError,
  kafkaMessageProcessError,
} from "pagopa-interop-models";

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
export async function runConsumer(
  topics: string[],
  consumerHandler: (messagePayload: EachMessagePayload) => Promise<void>,
  config: KafkaConsumerConfig,
  logger: Logger,
  onShutdown?: () => Promise<void>,
  onReady?: (disconnect: () => Promise<void>) => void
) {
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
            messageInfo,
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
  onShutdown,
  onReady,
}: {
  topics: string[];
  consumerHandler: (payload: EachBatchPayload) => Promise<void>;
  config: KafkaConsumerConfig;
  batchConfig: KafkaBatchConsumerConfig;
  logger: Logger;
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
          const kafkaMessageProcessErr = genericInternalError(
            `Error handling Kafka batch. Topic: ${payload.batch.topic}. Partition: ${payload.batch.partition}. Last offset: ${payload.batch.lastOffset()}. Cause: ${
              e instanceof Error ? e.message : String(e)
            }`
          );

          logger.error(
            `Detail: ${kafkaMessageProcessErr.detail}. Error: ${JSON.stringify(e)}`
          );

          throw kafkaMessageProcessErr;
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
