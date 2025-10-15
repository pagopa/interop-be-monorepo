import { z } from "zod";
import {
  AgreementTopicConfig,
  CatalogTopicConfig,
  PurposeTopicConfig,
  AuthorizationTopicConfig,
  DelegationTopicConfig,
  FileManagerConfig,
  LoggerConfig,
  S3Config,
  KafkaBatchConsumerConfig,
  SafeStorageApiConfig,
  DynamoDBClientConfig,
} from "pagopa-interop-commons";
import { SQSConsumerConfig } from "./sqsConfig.js";

export const AuditSignerConfig = SQSConsumerConfig.and(CatalogTopicConfig)
  .and(AgreementTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(PurposeTopicConfig)
  .and(DelegationTopicConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(LoggerConfig)
  .and(KafkaBatchConsumerConfig)
  .and(DynamoDBClientConfig)
  .and(SafeStorageApiConfig)
  .and(
    z
      .object({
        SERVICE_NAME: z.string(),
      })
      .transform((c) => ({
        serviceName: c.SERVICE_NAME,
      }))
  );

export type AuditSignerConfig = z.infer<typeof AuditSignerConfig>;

export const config: AuditSignerConfig = AuditSignerConfig.parse(process.env);
