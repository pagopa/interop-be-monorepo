import {
  CatalogTopicConfig,
  KafkaConsumerConfig,
} from "pagopa-interop-commons";
import { logLevel } from "kafkajs";
import { z } from "zod";

const CatalogOutboundWriterConfig = KafkaConsumerConfig.and(CatalogTopicConfig)
  .and(
    z.object({
      CATALOG_OUTBOUND_TOPIC: z.string(),
      PRODUCER_KAFKA_BROKERS: z.string(),
      PRODUCER_KAFKA_CLIENT_ID: z.string(),
      PRODUCER_KAFKA_DISABLE_AWS_IAM_AUTH: z.literal("true").optional(),
      PRODUCER_KAFKA_LOG_LEVEL: z
        .enum(["NOTHING", "ERROR", "WARN", "INFO", "DEBUG"])
        .default("WARN"),
      PRODUCER_KAFKA_REAUTHENTICATION_THRESHOLD: z
        .number()
        .default(20)
        .transform((n) => n * 1000),
    })
  )
  .transform((c) => ({
    consumerConfig: {
      awsRegion: c.awsRegion,
      kafkaBrokers: c.kafkaBrokers,
      kafkaClientId: c.kafkaClientId,
      kafkaDisableAwsIamAuth: c.kafkaDisableAwsIamAuth,
      kafkaLogLevel: c.kafkaLogLevel,
      kafkaReauthenticationThreshold: c.kafkaReauthenticationThreshold,
      kafkaGroupId: c.kafkaGroupId,
      topicStartingOffset: c.topicStartingOffset,
    },
    producerConfig: {
      awsRegion: c.awsRegion,
      kafkaBrokers: c.PRODUCER_KAFKA_BROKERS,
      kafkaClientId: c.PRODUCER_KAFKA_CLIENT_ID,
      kafkaDisableAwsIamAuth: c.PRODUCER_KAFKA_DISABLE_AWS_IAM_AUTH === "true",
      kafkaLogLevel: logLevel[c.PRODUCER_KAFKA_LOG_LEVEL],
      kafkaReauthenticationThreshold:
        c.PRODUCER_KAFKA_REAUTHENTICATION_THRESHOLD,
    },
    catalogTopic: c.catalogTopic,
    catalogOutboundTopic: c.CATALOG_OUTBOUND_TOPIC,
  }));

export type CatalogOutboundWriterConfig = z.infer<
  typeof CatalogOutboundWriterConfig
>;

export const config: CatalogOutboundWriterConfig =
  CatalogOutboundWriterConfig.parse(process.env);
