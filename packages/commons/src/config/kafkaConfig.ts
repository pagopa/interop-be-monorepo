import { z } from "zod";
import { AWSConfig } from "./awsConfig.js";

/**
 * Kafka log level numeric values, matching both kafkajs and
 * @confluentinc/kafka-javascript conventions.
 */
export const KafkaLogLevel = {
  NOTHING: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 4,
  DEBUG: 5,
} as const satisfies Record<string, number>;

export const KafkaConfig = z
  .object({
    KAFKA_CLIENT_LIBRARY: z
      .enum(["kafkajs", "confluent"])
      .default("kafkajs"),
    KAFKA_BROKERS: z.string().transform((value) => value.split(",")),
    KAFKA_CLIENT_ID: z.string(),
    KAFKA_DISABLE_AWS_IAM_AUTH: z.literal("true").optional(),
    KAFKA_LOG_LEVEL: z
      .enum(["NOTHING", "ERROR", "WARN", "INFO", "DEBUG"])
      .default("WARN"),
    KAFKA_REAUTHENTICATION_THRESHOLD: z
      .number()
      .default(20)
      .transform((n) => n * 1000),
    KAFKA_BROKER_CONNECTION_STRING: z.string().optional(),
  })
  .and(AWSConfig)
  .transform((c) => ({
    awsRegion: c.awsRegion,
    kafkaClientLibrary: c.KAFKA_CLIENT_LIBRARY,
    kafkaBrokers: c.KAFKA_BROKERS,
    kafkaClientId: c.KAFKA_CLIENT_ID,
    kafkaDisableAwsIamAuth: c.KAFKA_DISABLE_AWS_IAM_AUTH === "true",
    kafkaLogLevel: KafkaLogLevel[c.KAFKA_LOG_LEVEL],
    kafkaReauthenticationThreshold: c.KAFKA_REAUTHENTICATION_THRESHOLD,
    kafkaBrokerConnectionString: c.KAFKA_BROKER_CONNECTION_STRING,
  }));
export type KafkaConfig = z.infer<typeof KafkaConfig>;
