import { logLevel } from "kafkajs";
import { z } from "zod";

export const KafkaConfig = z
  .object({
    KAFKA_BROKERS: z.string(),
    KAFKA_CLIENT_ID: z.string(),
    KAFKA_GROUP_ID: z.string(),
    KAFKA_DISABLE_AWS_IAM_AUTH: z.literal("true").optional(),
    KAFKA_LOG_LEVEL: z
      .enum(["NOTHING", "ERROR", "WARN", "INFO", "DEBUG"])
      .default("WARN"),
    KAFKA_REAUTHENTICATION_THRESHOLD: z
      .number()
      .default(20)
      .transform((n) => n * 1000),
  })
  .transform((c) => ({
    kafkaBrokers: c.KAFKA_BROKERS,
    kafkaClientId: c.KAFKA_CLIENT_ID,
    kafkaGroupId: c.KAFKA_GROUP_ID,
    kafkaDisableAwsIamAuth: c.KAFKA_DISABLE_AWS_IAM_AUTH === "true",
    kafkaLogLevel: logLevel[c.KAFKA_LOG_LEVEL],
    kafkaReauthenticationThreshold: c.KAFKA_REAUTHENTICATION_THRESHOLD,
  }));
export type KafkaConfig = z.infer<typeof KafkaConfig>;
