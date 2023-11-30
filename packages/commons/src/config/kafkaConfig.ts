import { z } from "zod";

export const KafkaConfig = z
  .object({
    KAFKA_BROKERS: z.string(),
    KAFKA_CLIENT_ID: z.string(),
    KAFKA_GROUP_ID: z.string(),
    KAFKA_DISABLE_AWS_IAM_AUTH: z.literal("true").optional(),
    KAFKA_TOPICS: z.string().transform((v) => v.split(",")), // comma-separated
  })
  .transform((c) => ({
    kafkaBrokers: c.KAFKA_BROKERS,
    kafkaClientId: c.KAFKA_CLIENT_ID,
    kafkaGroupId: c.KAFKA_GROUP_ID,
    kafkaDisableAwsIamAuth: c.KAFKA_DISABLE_AWS_IAM_AUTH === "true",
    kafkaTopics: c.KAFKA_TOPICS,
  }));
export type KafkaConfig = z.infer<typeof KafkaConfig>;
