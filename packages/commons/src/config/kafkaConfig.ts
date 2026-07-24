import { logLevel } from "kafkajs";
import { z } from "zod";

import { AWSConfig } from "./awsConfig.js";
import { FeatureFlagConfluentKafkaConfig } from "./featureFlagsConfig.js";

export const KafkaConfig = z
  .object({
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
    MSK_ROLE_ARN: z.string(),
  })
  .and(AWSConfig)
  .and(FeatureFlagConfluentKafkaConfig)
  .transform((c) => ({
    awsRegion: c.awsRegion,
    featureFlagConfluentKafka: c.featureFlagConfluentKafka,
    kafkaBrokers: c.KAFKA_BROKERS,
    kafkaClientId: c.KAFKA_CLIENT_ID,
    kafkaDisableAwsIamAuth: c.KAFKA_DISABLE_AWS_IAM_AUTH === "true",
    kafkaLogLevel: logLevel[c.KAFKA_LOG_LEVEL],
    kafkaReauthenticationThreshold: c.KAFKA_REAUTHENTICATION_THRESHOLD,
    kafkaBrokerConnectionString: c.KAFKA_BROKER_CONNECTION_STRING,
    mskAuth: c.KAFKA_DISABLE_AWS_IAM_AUTH
      ? undefined
      : {
          awsRegion: c.awsRegion,
          awsRoleArn: c.MSK_ROLE_ARN,
          awsRoleSessionName: c.KAFKA_CLIENT_ID,
        },
  }));
export type KafkaConfig = z.infer<typeof KafkaConfig>;
