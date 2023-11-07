export * from "./constants.js";
export * from "./create-authenticator.js";
export * from "./create-mechanism.js";
export * from "./create-payload.js";
export * from "./create-sasl-authentication-request.js";
export * from "./create-sasl-authentication-response.js";
import { Kafka, KafkaMessage } from "kafkajs";
import { ConsumerConfig, logger } from "pagopa-interop-commons";
import { createAuthenticator } from "./create-authenticator.js";
import { createMechanism } from "./create-mechanism.js";

export const awsIamAuthenticator = createAuthenticator;
export const DEFAULT_AUTHENTICATION_TIMEOUT = 20;

export const runConsumer = async (
  config: ConsumerConfig,
  topic: string,
  consumerHandler: (message: KafkaMessage) => Promise<void>
): Promise<void> => {
  setInterval(async () => {
    logger.debug(`Consumer connecting to topics [${config.kafkaBrokers}]...`);

    const kafkaConfig = config.kafkaDisableAwsIamAuth
      ? {
          clientId: config.kafkaClientId,
          brokers: [config.kafkaBrokers],
          ssl: false,
          authenticationTimeout: DEFAULT_AUTHENTICATION_TIMEOUT,
        }
      : {
          clientId: config.kafkaClientId,
          brokers: [config.kafkaBrokers],
          ssl: true,
          sasl: createMechanism({
            region: config.awsRegion,
            ttl: DEFAULT_AUTHENTICATION_TIMEOUT.toString(),
          }),
          authenticationTimeout: DEFAULT_AUTHENTICATION_TIMEOUT,
        };

    const kafka = new Kafka(kafkaConfig);
    const consumer = kafka.consumer({
      groupId: config.kafkaGroupId,
      sessionTimeout: DEFAULT_AUTHENTICATION_TIMEOUT,
      heartbeatInterval: 5,
    });
    await consumer.connect();
    logger.info("Consumer connected");

    await consumer.subscribe({
      topics: [topic],
      fromBeginning: true,
    });

    consumer.disconnect().finally(() => {
      logger.info("Consumer disconnected");
      process.exit(0);
    });

    await consumer.run({
      eachMessage: ({ message }) => consumerHandler(message),
    });
  }, DEFAULT_AUTHENTICATION_TIMEOUT);
};
