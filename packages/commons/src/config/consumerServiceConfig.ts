import { z } from "zod";
import { KafkaConfig } from "./kafkaConfig.js";
import { ReadModelDbConfig } from "./readmodelDbConfig.js";
import { TokenGenerationReadModelDbConfig } from "./tokenGenerationReadmodelDbConfig.js";

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

export const KafkaBatchConsumerConfig = KafkaConsumerConfig.and(
  z
    .object({
      MIN_BYTES_KAFKA_BATCH: z.coerce.number(),
      MAX_WAIT_KAFKA_BATCH: z.coerce.number(),
    })
    .transform((c) => ({
      minBytesKafkaBatch: c.MIN_BYTES_KAFKA_BATCH,
      maxWaitKafkaBatch: c.MAX_WAIT_KAFKA_BATCH,
    }))
);
export type KafkaBatchConsumerConfig = z.infer<typeof KafkaBatchConsumerConfig>;

export const ReadModelWriterConfig = KafkaConsumerConfig.and(ReadModelDbConfig);
export type ReadModelWriterConfig = z.infer<typeof ReadModelWriterConfig>;

export const PlatformStateWriterConfig = KafkaConsumerConfig.and(
  TokenGenerationReadModelDbConfig
);
export type PlatformStateWriterConfig = z.infer<
  typeof PlatformStateWriterConfig
>;
