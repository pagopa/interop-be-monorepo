import { KafkaJS } from "@confluentinc/kafka-javascript";
import { z } from "zod";

const { logLevel } = KafkaJS;

export const KafkaConfig = z
  .object({
    KAFKA_BROKERS: z.string(),
    KAFKA_CLIENT_ID: z.string(),
    KAFKA_DISABLE_AWS_IAM_AUTH: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    KAFKA_LOG_LEVEL: z
      .enum(["NOTHING", "ERROR", "WARN", "INFO", "DEBUG"])
      .default("INFO"),
    MSK_REGION: z.string().optional(),
    MSK_ROLE_ARN: z.string().optional(),
    POD_NAME: z.string().optional(),
    KAFKA_BROKER_CONNECTION_STRING: z.string().optional(),
  })
  .refine(
    (c) =>
      c.KAFKA_DISABLE_AWS_IAM_AUTH ||
      (c.MSK_REGION !== undefined && c.MSK_ROLE_ARN !== undefined),
    {
      message:
        "MSK_REGION and MSK_ROLE_ARN are required when IAM auth is enabled",
    }
  )
  .transform((c) => ({
    kafkaBrokers: c.KAFKA_BROKERS,
    kafkaClientId: c.KAFKA_CLIENT_ID,
    kafkaLogLevel: logLevel[c.KAFKA_LOG_LEVEL],
    mskAuth: c.KAFKA_DISABLE_AWS_IAM_AUTH
      ? undefined
      : {
          awsRegion: c.MSK_REGION as string,
          awsRoleArn: c.MSK_ROLE_ARN as string,
          awsRoleSessionName: c.POD_NAME ?? "kafka-commons-client",
        },
    kafkaBrokerConnectionString: c.KAFKA_BROKER_CONNECTION_STRING,
  }));
export type KafkaConfig = z.infer<typeof KafkaConfig>;

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

export const KafkaProducerConfig = KafkaConfig.and(
  z
    .object({
      KAFKA_TRANSACTIONAL_ID: z.string().optional(),
    })
    .transform((c) => ({
      kafkaTransactionalId: c.KAFKA_TRANSACTIONAL_ID,
    }))
);
export type KafkaProducerConfig = z.infer<typeof KafkaProducerConfig>;
