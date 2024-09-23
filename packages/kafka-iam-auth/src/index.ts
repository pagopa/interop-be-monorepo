import { generateAuthToken } from "aws-msk-iam-sasl-signer-js";
import {
  Consumer,
  EachMessagePayload,
  Kafka,
  KafkaConfig,
  OauthbearerProviderResponse,
  Producer,
  ProducerRecord,
  RecordMetadata,
  logLevel,
} from "kafkajs";
import {
  KafkaConsumerConfig,
  KafkaConfig as InteropKafkaConfig,
  Logger,
  genericLogger,
  KafkaProducerConfig,
} from "pagopa-interop-commons";
import { kafkaMessageProcessError } from "pagopa-interop-models";
import { P, match } from "ts-pattern";

const errorTypes = ["unhandledRejection", "uncaughtException"];
const signalTraps = ["SIGTERM", "SIGINT", "SIGUSR2"];

const processExit = (existStatusCode: number = 1): void => {
  genericLogger.debug(`Process exit with code ${existStatusCode}`);
  process.exit(existStatusCode);
};

const errorEventsListener = (consumerOrProducer: Consumer | Producer): void => {
  errorTypes.forEach((type) => {
    process.on(type, async (e) => {
      try {
        genericLogger.error(`Error ${type} intercepted; Error detail: ${e}`);
        await consumerOrProducer.disconnect().finally(() => {
          genericLogger.debug("Disconnected successfully");
        });
        processExit();
      } catch (e) {
        genericLogger.error(
          `Unexpected error on disconnection with event type ${type}; Error detail: ${e}`
        );
        processExit();
      }
    });
  });

  signalTraps.forEach((type) => {
    process.once(type, async () => {
      try {
        await consumerOrProducer.disconnect().finally(() => {
          genericLogger.debug("Disconnected successfully");
          processExit();
        });
      } finally {
        process.kill(process.pid, type);
      }
    });
  });
};

const consumerKafkaEventsListener = (consumer: Consumer): void => {
  if (genericLogger.isDebugEnabled()) {
    consumer.on(consumer.events.DISCONNECT, () => {
      genericLogger.debug(`Consumer has disconnected.`);
    });

    consumer.on(consumer.events.STOP, (e) => {
      genericLogger.debug(`Consumer has stopped ${JSON.stringify(e)}.`);
    });
  }

  consumer.on(consumer.events.CRASH, (e) => {
    genericLogger.error(`Error Consumer crashed ${JSON.stringify(e)}.`);
    processExit();
  });

  consumer.on(consumer.events.REQUEST_TIMEOUT, (e) => {
    genericLogger.error(
      `Error Request to a broker has timed out : ${JSON.stringify(e)}.`
    );
  });
};

const producerKafkaEventsListener = (producer: Producer): void => {
  if (genericLogger.isDebugEnabled()) {
    producer.on(producer.events.DISCONNECT, () => {
      genericLogger.debug(`Producer has disconnected.`);
    });
  }
  // eslint-disable-next-line sonarjs/no-identical-functions
  producer.on(producer.events.REQUEST_TIMEOUT, (e) => {
    genericLogger.error(
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

  genericLogger.debug(
    `Topic message offset ${Number(message.offset) + 1} committed`
  );
};

export async function resetPartitionsOffsets(
  topics: string[],
  kafka: Kafka,
  consumer: Consumer
): Promise<void> {
  const admin = kafka.admin();

  await admin.connect();

  const fetchedTopics = await admin.fetchTopicMetadata({ topics });
  fetchedTopics.topics.forEach((t) =>
    t.partitions.forEach((p) =>
      consumer.seek({
        topic: t.name,
        partition: p.partitionId,
        offset: "-2",
      })
    )
  );
  await admin.disconnect();
}

async function oauthBearerTokenProvider(
  region: string,
  logger: Logger
): Promise<OauthbearerProviderResponse> {
  logger.debug("Fetching token from AWS");

  const authTokenResponse = await generateAuthToken({
    region,
  });

  logger.debug(
    `Token fetched from AWS expires at ${authTokenResponse.expiryTime}`
  );

  return {
    value: authTokenResponse.token,
  };
}

const initKafka = (config: InteropKafkaConfig): Kafka => {
  const connectionStringMechanism: KafkaConfig["sasl"] =
    config.kafkaBrokerConnectionString
      ? {
          mechanism: "plain",
          username: "$ConnectionString",
          password: config.kafkaBrokerConnectionString,
        }
      : undefined;

  if (connectionStringMechanism) {
    genericLogger.warn(
      "Using connection string mechanism for Kafka Broker authentication - this will override other mechanisms. If that is not desired, remove Kafka broker connection string from env variables."
    );
  }

  const kafkaConfig: KafkaConfig = config.kafkaDisableAwsIamAuth
    ? {
        clientId: config.kafkaClientId,
        brokers: config.kafkaBrokers,
        logLevel: config.kafkaLogLevel,
        ssl: connectionStringMechanism ? true : false,
        sasl: connectionStringMechanism,
      }
    : {
        clientId: config.kafkaClientId,
        brokers: config.kafkaBrokers,
        logLevel: config.kafkaLogLevel,
        reauthenticationThreshold: config.kafkaReauthenticationThreshold,
        ssl: true,
        sasl: connectionStringMechanism ?? {
          mechanism: "oauthbearer",
          oauthBearerProvider: () =>
            oauthBearerTokenProvider(config.awsRegion, genericLogger),
        },
      };

  return new Kafka({
    ...kafkaConfig,
    logCreator:
      (_logLevel) =>
      ({ level, log }) => {
        const { message, error } = log;

        const filteredLevel = match(error)
          .with(
            P.string,
            (error) =>
              (level === logLevel.ERROR || level === logLevel.WARN) &&
              error.includes("The group is rebalancing, so a rejoin is needed"),
            () => logLevel.INFO
          )
          .otherwise(() => level);

        // eslint-disable-next-line sonarjs/no-nested-template-literals
        const msg = `${message}${error ? ` - ${error}` : ""}`;

        match(filteredLevel)
          .with(logLevel.NOTHING, logLevel.ERROR, () =>
            genericLogger.error(msg)
          )
          .with(logLevel.WARN, () => genericLogger.warn(msg))
          .with(logLevel.INFO, () => genericLogger.info(msg))
          .with(logLevel.DEBUG, () => genericLogger.debug(msg))
          .otherwise(() => genericLogger.error(msg));
      },
  });
};

const initConsumer = async (
  config: KafkaConsumerConfig,
  topics: string[],
  consumerHandler: (payload: EachMessagePayload) => Promise<void>
): Promise<Consumer> => {
  genericLogger.debug(
    `Consumer connecting to topics ${JSON.stringify(topics)}`
  );

  const kafka = initKafka(config);

  const consumer = kafka.consumer({
    groupId: config.kafkaGroupId,
    retry: {
      initialRetryTime: 100,
      maxRetryTime: 3000,
      retries: 3,
      restartOnFailure: (error) => {
        genericLogger.error(`Error during restart service: ${error.message}`);
        return Promise.resolve(false);
      },
    },
  });

  if (config.resetConsumerOffsets) {
    await resetPartitionsOffsets(topics, kafka, consumer);
  }

  consumerKafkaEventsListener(consumer);
  errorEventsListener(consumer);

  await consumer.connect();
  genericLogger.debug("Consumer connected");

  const topicExists = await validateTopicMetadata(kafka, topics);
  if (!topicExists) {
    processExit();
  }

  await consumer.subscribe({
    topics,
    fromBeginning: config.topicStartingOffset === "earliest",
  });

  genericLogger.info(`Consumer subscribed topic ${topics}`);

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

export const initProducer = async (
  config: KafkaProducerConfig,
  topic: string
): Promise<
  Producer & {
    send: (record: Omit<ProducerRecord, "topic">) => Promise<RecordMetadata[]>;
  }
> => {
  try {
    const kafka = initKafka({
      kafkaBrokers: config.producerKafkaBrokers,
      kafkaClientId: config.producerKafkaClientId,
      kafkaDisableAwsIamAuth: config.producerKafkaDisableAwsIamAuth,
      kafkaLogLevel: config.producerKafkaLogLevel,
      kafkaReauthenticationThreshold:
        config.producerKafkaReauthenticationThreshold,
      awsRegion: config.awsRegion,
      kafkaBrokerConnectionString: config.producerKafkaBrokerConnectionString,
    });

    const producer = kafka.producer({
      allowAutoTopicCreation: false,
      retry: {
        initialRetryTime: 100,
        maxRetryTime: 3000,
        retries: 3,
        restartOnFailure: (error) => {
          genericLogger.error(`Error during restart service: ${error.message}`);
          return Promise.resolve(false);
        },
      },
    });

    producerKafkaEventsListener(producer);
    errorEventsListener(producer);

    await producer.connect();

    genericLogger.debug("Producer connected");

    const topicExists = await validateTopicMetadata(kafka, [topic]);
    if (!topicExists) {
      processExit();
    }

    return {
      ...producer,
      send: async (record: Omit<ProducerRecord, "topic">) =>
        await producer.send({
          ...record,
          topic,
        }),
    };
  } catch (e) {
    genericLogger.error(
      `Generic error occurs during consumer initialization: ${e}`
    );
    processExit();
    return undefined as never;
  }
};

export const runConsumer = async (
  config: KafkaConsumerConfig,
  topics: string[],
  consumerHandler: (messagePayload: EachMessagePayload) => Promise<void>
): Promise<void> => {
  try {
    await initConsumer(config, topics, consumerHandler);
  } catch (e) {
    genericLogger.error(
      `Generic error occurs during consumer initialization: ${e}`
    );
    processExit();
  }
};

export const validateTopicMetadata = async (
  kafka: Kafka,
  topicNames: string[]
): Promise<boolean> => {
  genericLogger.debug(
    `Check topics [${JSON.stringify(topicNames)}] existence...`
  );

  const admin = kafka.admin();
  await admin.connect();

  try {
    const { topics } = await admin.fetchTopicMetadata({
      topics: [...topicNames],
    });
    genericLogger.debug(`Topic metadata: ${JSON.stringify(topics)} `);
    await admin.disconnect();
    return true;
  } catch (e) {
    await admin.disconnect();
    genericLogger.error(
      `Unable to subscribe! Error during topic metadata fetch: ${JSON.stringify(
        e
      )}`
    );
    return false;
  }
};
