import { generateAuthToken } from "aws-msk-iam-sasl-signer-js";
import { KafkaJS } from "@confluentinc/kafka-javascript";
import {
  KafkaConsumerConfig,
  KafkaConfig as InteropKafkaConfig,
  Logger,
  genericLogger,
  KafkaProducerConfig,
  KafkaBatchConsumerConfig,
} from "pagopa-interop-commons";
import { kafkaMessageProcessError } from "pagopa-interop-models";
import {
  processExit,
  errorEventsListener,
  kafkaCommitMessageOffsets,
  extractBasicMessageInfo,
} from "./common.js";

/**
 * Map our KafkaLogLevel values (which use kafkajs convention: INFO=4, DEBUG=5)
 * to Confluent's logLevel enum (INFO=3, DEBUG=4).
 */
const toConfluentLogLevel = (level: number): KafkaJS.logLevel => {
  const mapping: Record<number, KafkaJS.logLevel> = {
    0: KafkaJS.logLevel.NOTHING,
    1: KafkaJS.logLevel.ERROR,
    2: KafkaJS.logLevel.WARN,
    4: KafkaJS.logLevel.INFO,
    5: KafkaJS.logLevel.DEBUG,
  };
  return mapping[level] ?? KafkaJS.logLevel.WARN;
};

async function oauthBearerTokenProvider(
  region: string,
  logger: Logger
): Promise<KafkaJS.OauthbearerProviderResponse> {
  logger.info("Requesting AWS authentication token");

  const authTokenResponse = await generateAuthToken({
    region,
  });

  logger.info(
    `AWS authentication token obtained, expires at ${authTokenResponse.expiryTime}`
  );

  return {
    value: authTokenResponse.token,
    principal: "kafka",
    lifetime: new Date(authTokenResponse.expiryTime).getTime(),
  };
}

const initKafka = (config: InteropKafkaConfig): KafkaJS.Kafka => {
  const commonConfigProps: Partial<KafkaJS.KafkaConfig> = {
    clientId: config.kafkaClientId,
    brokers: config.kafkaBrokers,
    logLevel: toConfluentLogLevel(config.kafkaLogLevel),
  };

  const connectionStringKafkaConfig: KafkaJS.KafkaConfig | undefined =
    config.kafkaBrokerConnectionString
      ? {
          ...commonConfigProps,
          brokers: config.kafkaBrokers,
          ssl: true,
          sasl: {
            mechanism: "plain",
            username: "$ConnectionString",
            password: config.kafkaBrokerConnectionString,
          },
        }
      : undefined;

  const iamAuthKafkaConfig: KafkaJS.KafkaConfig = config.kafkaDisableAwsIamAuth
    ? {
        ...commonConfigProps,
        brokers: config.kafkaBrokers,
        ssl: false,
      }
    : {
        ...commonConfigProps,
        brokers: config.kafkaBrokers,
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

  const kafkaConfig: KafkaJS.KafkaConfig =
    connectionStringKafkaConfig ?? iamAuthKafkaConfig;

  // Note: Confluent KafkaJS compat layer does not support logCreator.
  // Logging is handled natively by librdkafka.
  //
  // reauthenticationThreshold is intentionally omitted: the Confluent library
  // does not support it and throws ERR__INVALID_ARG if set. Re-authentication
  // is handled automatically by librdkafka at 80% of connections.max.reauth.ms.
  return new KafkaJS.Kafka({ kafkaJS: kafkaConfig });
};

export async function resetPartitionsOffsets(
  topics: string[],
  kafka: KafkaJS.Kafka,
  consumer: KafkaJS.Consumer
): Promise<void> {
  const admin = kafka.admin();

  await admin.connect();

  const fetchedTopics = await admin.fetchTopicMetadata({ topics });
  fetchedTopics.topics.forEach(
    (t: KafkaJS.ITopicMetadata) =>
      t.partitions.forEach((p: KafkaJS.PartitionMetadata) =>
        consumer.seek({
          topic: t.name,
          partition: p.partitionId,
          offset: "-2",
        })
      )
  );
  await admin.disconnect();
}

export const validateTopicMetadata = async (
  kafka: KafkaJS.Kafka,
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

const initCustomConsumer = async ({
  config,
  topics,
  consumerRunConfig,
  batchConsumerConfig,
}: {
  config: KafkaConsumerConfig;
  topics: string[];
  consumerRunConfig: (consumer: KafkaJS.Consumer) => KafkaJS.ConsumerRunConfig;
  batchConsumerConfig?: KafkaBatchConsumerConfig;
}): Promise<KafkaJS.Consumer> => {
  genericLogger.debug(
    `Consumer connecting to topics ${JSON.stringify(topics)}`
  );

  const kafka = initKafka(config);

  // Confluent KafkaJS compat: fromBeginning and autoCommit are consumer-level
  // config, not subscribe/run-level. restartOnFailure is not supported (consumer
  // always restarts, but the unhandledRejection/uncaughtException process
  // handlers call processExit() to prevent runaway restarts).
  const consumer = kafka.consumer({
    kafkaJS: {
      groupId: config.kafkaGroupId,
      fromBeginning: config.topicStartingOffset === "earliest",
      autoCommit: false,
      retry: {
        initialRetryTime: 100,
        maxRetryTime: 3000,
        retries: 3,
      },
      maxWaitTimeInMs: batchConsumerConfig?.maxWaitKafkaBatchMillis,
      minBytes: batchConsumerConfig?.minBytes,
      maxBytes: batchConsumerConfig?.maxBytes,
      sessionTimeout: batchConsumerConfig?.sessionTimeoutMillis,
    },
  });

  // Note: Confluent KafkaJS compat layer does not expose .on()/.events in its
  // type definitions. Event listeners for CRASH, REQUEST_TIMEOUT, etc. are not
  // available. Process-level error handlers (unhandledRejection, uncaughtException,
  // SIGTERM, SIGINT) still protect against unrecoverable failures.
  errorEventsListener(consumer);

  await consumer.connect();
  genericLogger.debug("Consumer connected");

  if (config.resetConsumerOffsets) {
    await resetPartitionsOffsets(topics, kafka, consumer);
  }

  const topicExists = await validateTopicMetadata(kafka, topics);
  if (!topicExists) {
    processExit();
  }

  await consumer.subscribe({ topics });

  genericLogger.info(`Consumer subscribed topic ${topics}`);

  await consumer.run(consumerRunConfig(consumer));
  return consumer;
};

// Transactions are currently supported only for single-replica producers,
// if scaling up/down is required, ensure proper handling of transactional IDs
export const initProducer = async (
  config: KafkaProducerConfig,
  topic: string,
  transactionalId?: string
): Promise<
  KafkaJS.Producer & {
    send: (record: Omit<KafkaJS.ProducerRecord, "topic">) => Promise<KafkaJS.RecordMetadata[]>;
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
      kafkaClientLibrary: config.kafkaClientLibrary,
    });

    const producer = kafka.producer({
      kafkaJS: {
        allowAutoTopicCreation: false,
        transactionalId: transactionalId ? transactionalId : undefined,
        retry: {
          initialRetryTime: 100,
          maxRetryTime: 3000,
          retries: 3,
        },
      },
    });

    // Note: Confluent KafkaJS compat layer does not expose .on()/.events in
    // type definitions. Process-level error handlers still protect.
    errorEventsListener(producer);

    await producer.connect();

    genericLogger.debug("Producer connected");

    const topicExists = await validateTopicMetadata(kafka, [topic]);
    if (!topicExists) {
      processExit();
    }

    return {
      ...producer,
      send: async (record: Omit<KafkaJS.ProducerRecord, "topic">) =>
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
  consumerHandler: (messagePayload: KafkaJS.EachMessagePayload) => Promise<void>,
  serviceName?: string
): Promise<void> => {
  try {
    const consumerRunConfig = (consumer: KafkaJS.Consumer): KafkaJS.ConsumerRunConfig => ({
      eachMessage: async (payload: KafkaJS.EachMessagePayload): Promise<void> => {
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
  consumerHandlerBatch: (messagePayload: KafkaJS.EachBatchPayload) => Promise<void>,
  serviceName?: string
): Promise<void> => {
  try {
    const consumerRunConfig = (): KafkaJS.ConsumerRunConfig => ({
      eachBatch: async (payload: KafkaJS.EachBatchPayload): Promise<void> => {
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
