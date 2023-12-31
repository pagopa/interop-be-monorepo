/* eslint-disable no-constant-condition */
export * from "./constants.js";
export * from "./create-authenticator.js";
export * from "./create-mechanism.js";
export * from "./create-payload.js";
export * from "./create-sasl-authentication-request.js";
export * from "./create-sasl-authentication-response.js";
import { Consumer, Kafka, EachMessagePayload } from "kafkajs";
import { ConsumerConfig, logger } from "pagopa-interop-commons";
import { createMechanism } from "./create-mechanism.js";

export const DEFAULT_AUTHENTICATION_TIMEOUT = 60 * 60 * 1000;
export const REAUTHENTICATION_THRESHOLD = 20 * 1000;

const errorTypes = ["unhandledRejection", "uncaughtException"];
const signalTraps = ["SIGTERM", "SIGINT", "SIGUSR2"];

const handleExit = (consumer: Consumer): void => {
  errorTypes.forEach((type) => {
    process.on(type, async (e) => {
      try {
        logger.info(`process.on ${type}`);
        logger.error(e);
        await consumer.disconnect().finally(() => {
          logger.info("Consumer disconnected");
          process.exit(0);
        });
        process.exit(0);
      } catch (_) {
        process.exit(1);
      }
    });
  });

  signalTraps.forEach((type) => {
    process.once(type, async () => {
      try {
        await consumer.disconnect().finally(() => {
          logger.info("Consumer disconnected");
          process.exit(0);
        });
      } finally {
        process.kill(process.pid, type);
      }
    });
  });
};

const initConsumer = async (
  config: ConsumerConfig,
  consumerHandler: (payload: EachMessagePayload) => Promise<void>
): Promise<Consumer> => {
  logger.info(
    `Consumer connecting to topics [${JSON.stringify(config.kafkaTopics)}]`
  );

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
        sasl: createMechanism({
          region: config.awsRegion,
          ttl: DEFAULT_AUTHENTICATION_TIMEOUT.toString(),
        }),
      };

  const kafka = new Kafka(kafkaConfig);
  const consumer = kafka.consumer({ groupId: config.kafkaGroupId });

  handleExit(consumer);

  await consumer.connect();
  logger.info("Consumer connected");

  await consumer.subscribe({
    topics: config.kafkaTopics,
    fromBeginning: true,
  });

  await consumer.run({
    eachMessage: consumerHandler,
  });
  return consumer;
};

export const runConsumer = async (
  config: ConsumerConfig,
  consumerHandler: (messagePayload: EachMessagePayload) => Promise<void>
): Promise<void> => {
  do {
    const consumer = await initConsumer(config, consumerHandler);

    await new Promise((resolve) =>
      setTimeout(
        resolve,
        DEFAULT_AUTHENTICATION_TIMEOUT - REAUTHENTICATION_THRESHOLD
      )
    );

    await consumer.disconnect().finally(() => {
      logger.info("Consumer disconnected");
    });
  } while (true);
};
