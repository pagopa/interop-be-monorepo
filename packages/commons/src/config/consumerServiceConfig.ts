import { z } from "zod";
import { KafkaConfig } from "./kafkaConfig.js";
import { TokenGenerationReadModelDbConfig } from "./tokenGenerationReadmodelDbConfig.js";
import { ReadModelSQLDbConfig } from "./readmodelSQLDbConfig.js";

export const KafkaConsumerConfig = KafkaConfig.and(
  z
    .object({
      KAFKA_GROUP_ID: z.string(),
      TOPIC_STARTING_OFFSET: z
        .union([z.literal("earliest"), z.literal("latest")])
        .default("latest"),
      RESET_CONSUMER_OFFSETS: z.string().default("false"),
    })
    .transform((c) => ({
      kafkaGroupId: c.KAFKA_GROUP_ID,
      topicStartingOffset: c.TOPIC_STARTING_OFFSET,
      resetConsumerOffsets: c.RESET_CONSUMER_OFFSETS.toLowerCase() === "true",
    }))
);
export type KafkaConsumerConfig = z.infer<typeof KafkaConsumerConfig>;

export const KafkaBatchConsumerConfig = z
  .object({
    AVERAGE_KAFKA_MESSAGE_SIZE_IN_BYTES: z.coerce.number(),
    MESSAGES_TO_READ_PER_BATCH: z.coerce.number(),
    MAX_WAIT_KAFKA_BATCH_MILLIS: z.coerce.number(),
  })
  .transform((c) => {
    const minBytes =
      c.AVERAGE_KAFKA_MESSAGE_SIZE_IN_BYTES * c.MESSAGES_TO_READ_PER_BATCH;
    return {
      minBytes,
      maxWaitKafkaBatchMillis: c.MAX_WAIT_KAFKA_BATCH_MILLIS,
      sessionTimeoutMillis: Math.round(c.MAX_WAIT_KAFKA_BATCH_MILLIS * 1.5),
      maxBytes: Math.round(minBytes * 1.25),
    };
  });
export type KafkaBatchConsumerConfig = z.infer<typeof KafkaBatchConsumerConfig>;

export const ReadModelWriterConfigSQL =
  KafkaConsumerConfig.and(ReadModelSQLDbConfig);
export type ReadModelWriterConfigSQL = z.infer<typeof ReadModelWriterConfigSQL>;

export const PlatformStateWriterConfig = KafkaConsumerConfig.and(
  TokenGenerationReadModelDbConfig
);
export type PlatformStateWriterConfig = z.infer<
  typeof PlatformStateWriterConfig
>;
