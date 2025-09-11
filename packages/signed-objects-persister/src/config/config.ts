import {
  LoggerConfig,
  S3Config,
  FileManagerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";
import { SQSConsumerConfig } from "./sqsConfig.js";

export const SignedObjectsPersisterConfig = SQSConsumerConfig.and(LoggerConfig)
  .and(S3Config)
  .and(FileManagerConfig)
  .and(
    z
      .object({
        SERVICE_NAME: z.string(),
        DB_TABLE_NAME: z.string(),
        AWS_REGION: z.string(),
      })
      .transform((c) => ({
        serviceName: c.SERVICE_NAME,
        dbTableName: c.DB_TABLE_NAME,
        awsRegion: c.AWS_REGION,
      }))
  );

export type SignedObjectFallbackConfig = z.infer<
  typeof SignedObjectsPersisterConfig
>;

export const config: SignedObjectFallbackConfig =
  SignedObjectsPersisterConfig.parse(process.env);

export const safeStorageApiConfigSchema = z
  .object({
    SAFE_STORAGE_BASE_URL: z.string(),
    SAFE_STORAGE_API_KEY: z.string(),
    SAFE_STORAGE_CLIENT_ID: z.string(),
    SAFE_STORAGE_DOC_TYPE: z.string(),
    SAFE_STORAGE_DOC_STATUS: z.string(),
    SAFE_STORAGE_HOST: z.string(),
    SAFE_STORAGE_PORT: z.preprocess(
      (a) => parseInt(z.string().parse(a), 10),
      z.number()
    ),
  })
  .transform((c) => ({
    safeStorageBaseUrl: c.SAFE_STORAGE_BASE_URL,
    safeStorageApiKey: c.SAFE_STORAGE_API_KEY,
    safeStorageClientId: c.SAFE_STORAGE_CLIENT_ID,
    safeStorageDocType: c.SAFE_STORAGE_DOC_TYPE,
    safeStorageDocStatus: c.SAFE_STORAGE_DOC_STATUS,
    safeStorageHost: c.SAFE_STORAGE_HOST,
    safeStoragePort: c.SAFE_STORAGE_PORT,
  }));

export type SafeStorageApiConfig = z.infer<typeof safeStorageApiConfigSchema>;

export const safeStorageConfig = safeStorageApiConfigSchema.parse(process.env);
