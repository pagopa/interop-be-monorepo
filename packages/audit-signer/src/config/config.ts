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
} from "pagopa-interop-commons";
import { SQSConsumerConfig } from "./sqsConfig.js";

export const safeStorageApiConfigSchema = z
  .object({
    SAFE_STORAGE_BASE_URL: z.string(),
    SAFE_STORAGE_API_KEY: z.string(),
    SAFE_STORAGE_CLIENT_ID: z.string(),
    SAFE_STORAGE_DOC_TYPE: z.string(),
    SAFE_STORAGE_DOC_STATUS: z.string(),
    SAFE_STORAGE_HOST: z.string(),
  })
  .transform((c) => ({
    safeStorageBaseUrl: c.SAFE_STORAGE_BASE_URL,
    safeStorageApiKey: c.SAFE_STORAGE_API_KEY,
    safeStorageClientId: c.SAFE_STORAGE_CLIENT_ID,
    safeStorageDocType: c.SAFE_STORAGE_DOC_TYPE,
    safeStorageDocStatus: c.SAFE_STORAGE_DOC_STATUS,
    safeStorageHost: c.SAFE_STORAGE_HOST,
  }));

export const AuditsSignerConfig = z
  .object({
    SIGNATURE_REFERENCES_TABLE_NAME: z.string(),
  })
  .transform((c) => ({
    signatureReferencesTableName: c.SIGNATURE_REFERENCES_TABLE_NAME,
  }));

export type SafeStorageApiConfig = z.infer<typeof safeStorageApiConfigSchema>;

export const safeStorageApiConfig = safeStorageApiConfigSchema.parse(
  process.env
);

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
