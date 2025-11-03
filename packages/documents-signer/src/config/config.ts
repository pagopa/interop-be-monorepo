import {
  AgreementTopicConfig,
  AWSConfig,
  DelegationTopicConfig,
  DynamoDBClientConfig,
  KafkaConsumerConfig,
  LoggerConfig,
  PurposeTopicConfig,
  S3Config,
  SafeStorageApiConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const DocumentsSignerConfig = S3Config.and(LoggerConfig)
  .and(AgreementTopicConfig)
  .and(DelegationTopicConfig)
  .and(KafkaConsumerConfig)
  .and(PurposeTopicConfig)
  .and(SafeStorageApiConfig)
  .and(DynamoDBClientConfig)
  .and(AWSConfig)
  .and(
    z
      .object({
        SERVICE_NAME: z.string(),
      })
      .transform((c) => ({
        serviceName: c.SERVICE_NAME,
      }))
  );

export type DocumentsSignerConfig = z.infer<typeof DocumentsSignerConfig>;

export const config: DocumentsSignerConfig = DocumentsSignerConfig.parse(
  process.env
);

export const baseConsumerConfig: KafkaConsumerConfig =
  KafkaConsumerConfig.parse(process.env);
