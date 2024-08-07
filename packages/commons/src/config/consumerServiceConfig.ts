import { z } from "zod";
import { KafkaConfig } from "./kafkaConfig.js";
import { ReadModelDbConfig } from "./readmodelDbConfig.js";

export const KafkaConsumerConfig = KafkaConfig.and(
  z
    .object({
      KAFKA_GROUP_ID: z.string(),
      TOPIC_STARTING_OFFSET: z
        .union([z.literal("earliest"), z.literal("latest")])
        .default("latest"),
    })
    .transform((c) => ({
      kafkaGroupId: c.KAFKA_GROUP_ID,
      topicStartingOffset: c.TOPIC_STARTING_OFFSET,
    }))
);
export type KafkaConsumerConfig = z.infer<typeof KafkaConsumerConfig>;

export const ReadModelWriterConfig = KafkaConsumerConfig.and(ReadModelDbConfig);
export type ReadModelWriterConfig = z.infer<typeof ReadModelWriterConfig>;
