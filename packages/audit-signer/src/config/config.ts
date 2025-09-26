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
} from "pagopa-interop-commons";
import { SQSConsumerConfig } from "./sqsConfig.js";

export const AuditsSignerConfig = z
  .object({
    SIGNATURE_REFERENCES_TABLE_NAME: z.string(),
  })
  .transform((c) => ({
    signatureReferencesTableName: c.SIGNATURE_REFERENCES_TABLE_NAME,
  }));

export type AuditsSignerConfig = z.infer<typeof AuditsSignerConfig>;

export const AuditSignerConfig = SQSConsumerConfig.and(CatalogTopicConfig)
  .and(AgreementTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(PurposeTopicConfig)
  .and(DelegationTopicConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(LoggerConfig)
  .and(KafkaBatchConsumerConfig)
  .and(AuditsSignerConfig)
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
