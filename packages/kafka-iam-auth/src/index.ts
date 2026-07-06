import {
  KafkaConsumerConfig,
  KafkaProducerConfig,
  KafkaBatchConsumerConfig,
} from "pagopa-interop-commons";
import * as kafkajsClient from "./kafkajs-client.js";
import * as confluentClient from "./confluent-client.js";
import type {
  EachMessagePayload,
  EachBatchPayload,
  Producer,
  ProducerRecord,
  RecordMetadata,
} from "./types.js";

// Re-export library-agnostic types for consumers of this package.
export type {
  Batch,
  EachBatchPayload,
  EachMessagePayload,
  KafkaMessage,
  ProducerRecord,
  RecordMetadata,
} from "./types.js";

export { extractBasicMessageInfo } from "./common.js";

type KafkaClientLibrary = "kafkajs" | "confluent";

const getClientLibrary = (config: {
  kafkaClientLibrary?: KafkaClientLibrary;
}): KafkaClientLibrary => config.kafkaClientLibrary ?? "kafkajs";

// Transactions are currently supported only for single-replica producers,
// if scaling up/down is required, ensure proper handling of transactional IDs
export const initProducer = async (
  config: KafkaProducerConfig,
  topic: string,
  transactionalId?: string
): Promise<
  Producer & {
    send: (record: Omit<ProducerRecord, "topic">) => Promise<RecordMetadata[]>;
  }
> => {
  const library = getClientLibrary(config);
  if (library === "confluent") {
    return confluentClient.initProducer(config, topic, transactionalId);
  }
  return kafkajsClient.initProducer(config, topic, transactionalId);
};

export const runConsumer = async (
  config: KafkaConsumerConfig,
  topics: string[],
  consumerHandler: (messagePayload: EachMessagePayload) => Promise<void>,
  serviceName?: string
): Promise<void> => {
  const library = getClientLibrary(config);
  if (library === "confluent") {
    return confluentClient.runConsumer(
      config,
      topics,
      consumerHandler,
      serviceName
    );
  }
  return kafkajsClient.runConsumer(
    config,
    topics,
    consumerHandler,
    serviceName
  );
};

export const runBatchConsumer = async (
  baseConsumerConfig: KafkaConsumerConfig,
  batchConsumerConfig: KafkaBatchConsumerConfig,
  topics: string[],
  consumerHandlerBatch: (messagePayload: EachBatchPayload) => Promise<void>,
  serviceName?: string
): Promise<void> => {
  const library = getClientLibrary(baseConsumerConfig);
  if (library === "confluent") {
    return confluentClient.runBatchConsumer(
      baseConsumerConfig,
      batchConsumerConfig,
      topics,
      consumerHandlerBatch,
      serviceName
    );
  }
  return kafkajsClient.runBatchConsumer(
    baseConsumerConfig,
    batchConsumerConfig,
    topics,
    consumerHandlerBatch,
    serviceName
  );
};

// resetPartitionsOffsets and validateTopicMetadata are not exported: they accept
// library-specific instances (kafkajs Kafka/Consumer vs Confluent KafkaJS.Kafka/Consumer)
// so routing via feature flag is not feasible. Each client module has its own copy
// and uses it internally within initCustomConsumer and initProducer.
