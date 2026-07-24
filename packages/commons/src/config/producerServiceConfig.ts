import { logLevel } from "kafkajs";
import { z } from "zod";

import { AWSConfig } from "./awsConfig.js";
import { FeatureFlagConfluentKafkaConfig } from "./featureFlagsConfig.js";

export const KafkaProducerConfig = AWSConfig.and(
  FeatureFlagConfluentKafkaConfig
)
  .and(
    z.object({
      PRODUCER_KAFKA_BROKERS: z.string().transform((value) => value.split(",")),
      PRODUCER_KAFKA_CLIENT_ID: z.string(),
      PRODUCER_KAFKA_DISABLE_AWS_IAM_AUTH: z.literal("true").optional(),
      PRODUCER_KAFKA_LOG_LEVEL: z
        .enum(["NOTHING", "ERROR", "WARN", "INFO", "DEBUG"])
        .default("WARN"),
      PRODUCER_KAFKA_REAUTHENTICATION_THRESHOLD: z
        .number()
        .default(20)
        .transform((n) => n * 1000),
      PRODUCER_KAFKA_BROKER_CONNECTION_STRING: z.string().optional(),
      PRODUCER_KAFKA_TRANSACTIONAL_ID: z.string().optional(),
      MSK_ROLE_ARN: z.string(),
    })
  )
  .transform((c) => ({
    ...c,
    producerKafkaBrokers: c.PRODUCER_KAFKA_BROKERS,
    producerKafkaClientId: c.PRODUCER_KAFKA_CLIENT_ID,
    producerKafkaDisableAwsIamAuth:
      c.PRODUCER_KAFKA_DISABLE_AWS_IAM_AUTH === "true",
    producerKafkaLogLevel: logLevel[c.PRODUCER_KAFKA_LOG_LEVEL],
    producerKafkaReauthenticationThreshold:
      c.PRODUCER_KAFKA_REAUTHENTICATION_THRESHOLD,
    producerKafkaBrokerConnectionString:
      c.PRODUCER_KAFKA_BROKER_CONNECTION_STRING,
    producerKafkaTransactionalId: c.PRODUCER_KAFKA_TRANSACTIONAL_ID,
    mskAuth: c.PRODUCER_KAFKA_DISABLE_AWS_IAM_AUTH
      ? undefined
      : {
          awsRegion: c.awsRegion,
          awsRoleArn: c.MSK_ROLE_ARN,
          awsRoleSessionName: c.PRODUCER_KAFKA_CLIENT_ID,
        },
  }));
export type KafkaProducerConfig = z.infer<typeof KafkaProducerConfig>;
