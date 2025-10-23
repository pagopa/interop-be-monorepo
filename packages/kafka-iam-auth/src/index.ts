import { generateAuthToken } from "aws-msk-iam-sasl-signer-js";
import {
  Consumer,
  ConsumerRunConfig,
  EachBatchPayload,
  EachMessagePayload,
  Kafka,
  KafkaConfig,
  KafkaMessage,
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
  KafkaBatchConsumerConfig,
} from "pagopa-interop-commons";
import { kafkaMessageProcessError } from "pagopa-interop-models";
import { P, match } from "ts-pattern";

const errorTypes = ["unhandledRejection", "uncaughtException"];
const signalTraps = ["SIGTERM", "SIGINT", "SIGUSR2"];

const processExit = (exitStatusCode: number = 1): void => {
  genericLogger.debug(`Process exit with code ${exitStatusCode}`);
  process.exit(exitStatusCode);
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
    genericLogger.warn(
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
    genericLogger.warn(
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
  const commonConfigProps = {
    clientId: config.kafkaClientId,
    brokers: config.kafkaBrokers,
    logLevel: config.kafkaLogLevel,
  };

  const connectionStringKafkaConfig: KafkaConfig | undefined =
    config.kafkaBrokerConnectionString
      ? {
          ...commonConfigProps,
          reauthenticationThreshold: config.kafkaReauthenticationThreshold,
          ssl: true,
          sasl: {
            mechanism: "plain",
            username: "$ConnectionString",
            password: config.kafkaBrokerConnectionString,
          },
        }
      : undefined;

  const iamAuthKafkaConfig: KafkaConfig = config.kafkaDisableAwsIamAuth
    ? {
        ...commonConfigProps,
        ssl: false,
      }
    : {
        ...commonConfigProps,
        reauthenticationThreshold: config.kafkaReauthenticationThreshold,
        ssl: true,
        sasl: {
          mechanism: "oauthbearer",
          oauthBearerProvider: () =>
            oauthBearerTokenProvider(config.awsRegion, genericLogger),
        },
      };

  if (connectionStringKafkaConfig) {
    genericLogger.warn(
      "Using connection string mechanism for Kafka Broker authentication - this will override other mechanisms. If that is not desired, remove Kafka broker connection string from env variables."
    );
  }

  const kafkaConfig: KafkaConfig =
    connectionStringKafkaConfig ?? iamAuthKafkaConfig;

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
          .with(
            P.string,
            (error) =>
              level === logLevel.ERROR &&
              (error.includes("Connection error: read ECONNRESET") ||
                error.includes(
                  "The replica is not available for the requested topic-partition"
                )),
            () => logLevel.WARN
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

const initCustomConsumer = async ({
  config,
  topics,
  consumerRunConfig,
  batchConsumerConfig,
}: {
  config: KafkaConsumerConfig;
  topics: string[];
  consumerRunConfig: (consumer: Consumer) => ConsumerRunConfig;
  batchConsumerConfig?: KafkaBatchConsumerConfig;
}): Promise<Consumer> => {
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
        genericLogger.warn(`Error during restart service: ${error.message}`);
        return Promise.resolve(false);
      },
    },
    maxWaitTimeInMs: batchConsumerConfig?.maxWaitKafkaBatchMillis,
    minBytes: batchConsumerConfig?.minBytes,
    maxBytes: batchConsumerConfig?.maxBytes,
    sessionTimeout: batchConsumerConfig?.sessionTimeoutMillis,
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

  await consumer.run(consumerRunConfig(consumer));
  return consumer;
};

export const initProducer = async (
  config: KafkaProducerConfig,
  topic: string,
  transactionalId?: string
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
      transactionalId: transactionalId ? transactionalId : undefined,
      retry: {
        initialRetryTime: 100,
        maxRetryTime: 3000,
        retries: 3,
        restartOnFailure: (error) => {
          genericLogger.warn(`Error during restart service: ${error.message}`);
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
      `Generic error occurs during producer initialization: ${e}`
    );
    processExit();
    return undefined as never;
  }
};

export const runConsumer = async (
  config: KafkaConsumerConfig,
  topics: string[],
  consumerHandler: (messagePayload: EachMessagePayload) => Promise<void>,
  serviceName?: string
): Promise<void> => {
  try {
    const consumerRunConfig = (consumer: Consumer): ConsumerRunConfig => ({
      autoCommit: false,
      eachMessage: async (payload: EachMessagePayload): Promise<void> => {
        try {
          await consumerHandler(payload);
          await kafkaCommitMessageOffsets(consumer, payload);
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
    await initCustomConsumer({ config, topics, consumerRunConfig });
  } catch (e) {
    genericLogger.error(
      `Generic error occurs during consumer initialization: ${e}`
    );
    processExit();
  }
};

export const runBatchConsumer = async (
  baseConsumerConfig: KafkaConsumerConfig,
  batchConsumerConfig: KafkaBatchConsumerConfig,
  topics: string[],
  consumerHandlerBatch: (messagePayload: EachBatchPayload) => Promise<void>,
  serviceName?: string
): Promise<void> => {
  try {
    const consumerRunConfig = (): ConsumerRunConfig => ({
      eachBatch: async (payload: EachBatchPayload): Promise<void> => {
        try {
          await consumerHandlerBatch(payload);
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
    await initCustomConsumer({
      config: baseConsumerConfig,
      topics,
      consumerRunConfig,
      batchConsumerConfig,
    });
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

export function extractBasicMessageInfo(message: KafkaMessage): {
  offset: string;
  streamId?: string;
  eventType?: string;
  eventVersion?: number;
  streamVersion?: number;
  correlationId?: string;
} {
  try {
    if (!message.value) {
      return { offset: message.offset };
    }

    const rawMessage = JSON.parse(message.value.toString());
    const dataSource =
      rawMessage.value?.after || rawMessage.after || rawMessage;
    return {
      offset: message.offset,
      streamId: dataSource.stream_id || dataSource.streamId || dataSource.id,
      eventType: dataSource.type,
      eventVersion: dataSource.event_version,
      streamVersion: dataSource.version,
      correlationId: dataSource.correlation_id,
    };
  } catch {
    return { offset: message.offset };
  }
}
