/* eslint-disable no-constant-condition */
export * from "./constants.js";
export * from "./create-authenticator.js";
export * from "./create-mechanism.js";
export * from "./create-payload.js";
export * from "./create-sasl-authentication-request.js";
export * from "./create-sasl-authentication-response.js";
import { Consumer, EachMessagePayload, Kafka } from "kafkajs";
import { KafkaConsumerConfig, logger } from "pagopa-interop-commons";
import { kafkaMessageProcessError } from "pagopa-interop-models";
import { createMechanism } from "./create-mechanism.js";

export const DEFAULT_AUTHENTICATION_TIMEOUT = 60 * 60 * 1000;
export const REAUTHENTICATION_THRESHOLD = 20 * 1000;

const errorTypes = ["unhandledRejection", "uncaughtException"];
const signalTraps = ["SIGTERM", "SIGINT", "SIGUSR2"];

const processExit = (existStatusCode: number = 1): void => {
  logger.debug(`Process exit with code ${existStatusCode}`);
  process.exit(existStatusCode);
};

const errorEventsListener = (consumer: Consumer): void => {
  errorTypes.forEach((type) => {
    process.on(type, async (e) => {
      try {
        logger.error(`Error ${type} intercepted; Error detail: ${e}`);
        await consumer.disconnect().finally(() => {
          logger.debug("Consumer disconnected properly");
        });
        processExit();
      } catch (e) {
        logger.error(
          `Unexpected error on consumer disconnection with event type ${type}; Error detail: ${e}`
        );
        processExit();
      }
    });
  });

  signalTraps.forEach((type) => {
    process.once(type, async () => {
      try {
        await consumer.disconnect().finally(() => {
          logger.debug("Consumer disconnected properly");
          processExit();
        });
      } finally {
        process.kill(process.pid, type);
      }
    });
  });
};

const kafkaEventsListener = (consumer: Consumer): void => {
  if (logger.isDebugEnabled()) {
    consumer.on(consumer.events.DISCONNECT, () => {
      logger.debug(`Consumer has disconnected.`);
    });

    consumer.on(consumer.events.STOP, (e) => {
      logger.debug(`Consumer has stopped ${JSON.stringify(e)}.`);
    });
  }

  consumer.on(consumer.events.CRASH, (e) => {
    logger.error(`Error Consumer crashed ${JSON.stringify(e)}.`);
    processExit();
  });

  consumer.on(consumer.events.REQUEST_TIMEOUT, (e) => {
    logger.error(
      `Error Request to a broker has timed out : ${JSON.stringify(e)}.`
    );
  });
};

const kafkaCommitMessageOffsets = async (
  consumer: Consumer,
  payload: EachMessagePayload
): Promise<void> => {
  const { topic, partition, message } = payload;
  await consumer.commitOffsets([
    { topic, partition, offset: (Number(message.offset) + 1).toString() },
  ]);

  logger.debug(`Topic message offset ${Number(message.offset) + 1} committed`);
};

const initConsumer = async (
  config: KafkaConsumerConfig,
  topics: string[],
  consumerHandler: (payload: EachMessagePayload) => Promise<void>
): Promise<Consumer> => {
  logger.debug(`Consumer connecting to topics ${JSON.stringify(topics)}`);

  const kafkaConfig = config.kafkaDisableAwsIamAuth
    ? {
        clientId: config.kafkaClientId,
        brokers: [config.kafkaBrokers],
        logLevel: config.kafkaLogLevel,
        ssl: false,
      }
    : {
        clientId: config.kafkaClientId,
        brokers: [config.kafkaBrokers],
        logLevel: config.kafkaLogLevel,
        ssl: true,
        sasl: createMechanism({
          region: config.awsRegion,
          ttl: DEFAULT_AUTHENTICATION_TIMEOUT.toString(),
        }),
      };

  const kafka = new Kafka(kafkaConfig);

  const consumer = kafka.consumer({
    groupId: config.kafkaGroupId,
    retry: {
      initialRetryTime: 100,
      maxRetryTime: 3000,
      retries: 3,
      restartOnFailure: (error) => {
        logger.error(`Error during restart service: ${error.message}`);
        return Promise.resolve(false);
      },
    },
  });

  kafkaEventsListener(consumer);
  errorEventsListener(consumer);

  await consumer.connect();
  logger.debug("Consumer connected");

  const topicExists = await validateTopicMetadata(kafka, topics);
  if (!topicExists) {
    processExit();
  }

  await consumer.subscribe({
    topics,
    fromBeginning: true,
  });

  logger.debug(`Consumer subscribed topic ${topics}`);

  await consumer.run({
    autoCommit: false,
    eachMessage: async (payload: EachMessagePayload) => {
      try {
        await consumerHandler(payload);
        await kafkaCommitMessageOffsets(consumer, payload);
      } catch (e) {
        throw kafkaMessageProcessError(
          payload.topic,
          payload.partition,
          payload.message.offset,
          e
        );
      }
    },
  });
  return consumer;
};

export const runConsumer = async (
  config: KafkaConsumerConfig,
  topics: string[],
  consumerHandler: (messagePayload: EachMessagePayload) => Promise<void>
): Promise<void> => {
  do {
    try {
      const consumer = await initConsumer(config, topics, consumerHandler);

      await new Promise((resolve) =>
        setTimeout(
          resolve,
          DEFAULT_AUTHENTICATION_TIMEOUT - REAUTHENTICATION_THRESHOLD
        )
      );

      await consumer.disconnect().finally(() => {
        logger.debug("Consumer disconnected");
      });
    } catch (e) {
      logger.error(`Generic error occurs during consumer initialization: ${e}`);
      processExit();
    }
  } while (true);
};

export const validateTopicMetadata = async (
  kafka: Kafka,
  topicNames: string[]
): Promise<boolean> => {
  logger.debug(`Check topics [${JSON.stringify(topicNames)}] existence...`);

  const admin = kafka.admin();
  await admin.connect();

  try {
    const { topics } = await admin.fetchTopicMetadata({
      topics: [...topicNames],
    });
    logger.debug(`Topic metadata: ${JSON.stringify(topics)} `);
    await admin.disconnect();
    return true;
  } catch (e) {
    await admin.disconnect();
    logger.error(
      `Unable to subscribe! Error during topic metadata fetch: ${JSON.stringify(
        e
      )}`
    );
    return false;
  }
};
