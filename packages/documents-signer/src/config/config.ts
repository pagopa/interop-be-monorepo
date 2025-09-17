import {
  AgreementTopicConfig,
  DelegationTopicConfig,
  KafkaConsumerConfig,
  LoggerConfig,
  PurposeTopicConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

export const DocumentsSignerConfig = S3Config.and(LoggerConfig)
  .and(AgreementTopicConfig)
  .and(DelegationTopicConfig)
  .and(KafkaConsumerConfig)
  .and(PurposeTopicConfig)
  .and(
    z
      .object({
        SERVICE_NAME: z.string(),
        DB_TABLE_NAME: z.string(),
      })
      .transform((c) => ({
        serviceName: c.SERVICE_NAME,
        dbTableName: c.DB_TABLE_NAME,
      }))
  );

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

export type SafeStorageApiConfig = z.infer<typeof safeStorageApiConfigSchema>;

export type DocumentsSignerConfig = z.infer<typeof DocumentsSignerConfig>;

export const config: DocumentsSignerConfig = DocumentsSignerConfig.parse(
  process.env
);

export const baseConsumerConfig: KafkaConsumerConfig =
  KafkaConsumerConfig.parse(process.env);

export const safeStorageApiConfig = safeStorageApiConfigSchema.parse(
  process.env
);
