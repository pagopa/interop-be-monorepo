import {
  AgreementTopicConfig,
  AWSConfig,
  DelegationTopicConfig,
  DynamoDBClientConfig,
  KafkaConsumerConfig,
  LoggerConfig,
  PurposeTemplateTopicConfig,
  PurposeTopicConfig,
  S3Config,
  SafeStorageApiConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const DocumentsSignerConfig = S3Config.and(LoggerConfig)
  .and(AgreementTopicConfig)
  .and(DelegationTopicConfig)
  .and(KafkaConsumerConfig)
  .and(PurposeTopicConfig)
  .and(PurposeTemplateTopicConfig)
  .and(SafeStorageApiConfig)
  .and(DynamoDBClientConfig)
  .and(AWSConfig);

type DocumentsSignerConfig = z.infer<typeof DocumentsSignerConfig>;

export const config: DocumentsSignerConfig = DocumentsSignerConfig.parse(
  process.env
);
