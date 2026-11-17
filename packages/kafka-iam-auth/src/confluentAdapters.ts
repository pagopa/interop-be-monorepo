import type {
  EachBatchPayload,
  EachMessagePayload,
  ProducerRecord,
  RecordMetadata,
} from "kafkajs";
import type {
  KafkaBatchConsumerConfig,
  KafkaConsumerConfig,
  KafkaProducerConfig,
} from "pagopa-interop-commons";

import { genericLogger } from "pagopa-interop-commons";
import { genericInternalError } from "pagopa-interop-models";

import {
  runBatchConsumer as confluentRunBatchConsumer,
  runConsumer as confluentRunConsumer,
} from "./confluent/consumer.js";
import { createProducer } from "./confluent/producer.js";

// kafkajs: NOTHING=0, ERROR=1, WARN=2, INFO=4, DEBUG=5 (https://github.com/tulios/kafkajs/blob/master/src/loggers/index.js#L3-L9)
// confluent: NOTHING=0, ERROR=1, WARN=2, INFO=3, DEBUG=4
function mapLogLevel(kafkajsLevel: number): number {
  if (kafkajsLevel >= 5) return 4; // DEBUG
  if (kafkajsLevel >= 4) return 3; // INFO
  return kafkajsLevel; // NOTHING, ERROR, WARN are the same in both
}

export async function runConsumerConfluent(
  config: KafkaConsumerConfig,
  topics: string[],
  consumerHandler: (payload: EachMessagePayload) => Promise<void>,
  serviceName?: string
): Promise<void> {
  return confluentRunConsumer({
    topics,
    consumerHandler,
    config: {
      ...config,
      kafkaLogLevel: mapLogLevel(config.kafkaLogLevel),
    },
    logger: genericLogger,
    serviceName,
  });
}

export async function runBatchConsumerConfluent(
  baseConsumerConfig: KafkaConsumerConfig,
  batchConsumerConfig: KafkaBatchConsumerConfig,
  topics: string[],
  consumerHandlerBatch: (payload: EachBatchPayload) => Promise<void>,
  serviceName?: string
): Promise<void> {
  return confluentRunBatchConsumer({
    topics,
    consumerHandler: (payload) =>
      consumerHandlerBatch({
        ...payload,
        uncommittedOffsets: () => {
          throw genericInternalError(
            "uncommittedOffsets is not supported in Confluent Kafka"
          );
        },
      }),
    config: {
      ...baseConsumerConfig,
      kafkaLogLevel: mapLogLevel(baseConsumerConfig.kafkaLogLevel),
    },
    batchConfig: batchConsumerConfig,
    logger: genericLogger,
    serviceName,
  });
}

export async function initProducerConfluent(
  config: KafkaProducerConfig,
  topic: string
): Promise<{
  send: (record: Omit<ProducerRecord, "topic">) => Promise<RecordMetadata[]>;
  disconnect: () => Promise<void>;
  transaction: () => Promise<{
    send(record: ProducerRecord): Promise<RecordMetadata[]>;
    commit(): Promise<void>;
    abort(): Promise<void>;
    isActive(): boolean;
  }>;
}> {
  const producer = await createProducer({
    topics: [topic],
    config: {
      ...config,
      producerKafkaLogLevel: mapLogLevel(config.producerKafkaLogLevel),
    },
    logger: genericLogger,
  });

  return {
    send: (record) => producer.send({ ...record, topic }),
    disconnect: () => producer.disconnect(),
    transaction: () => producer.transaction(),
  };
}
