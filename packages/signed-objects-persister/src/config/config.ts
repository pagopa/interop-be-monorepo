import {
  LoggerConfig,
  S3Config,
  FileManagerConfig,
  SafeStorageApiConfig,
} from "pagopa-interop-commons";
import { z } from "zod";
import { SQSConsumerConfig } from "./sqsConfig.js";

export const SignedObjectsPersisterConfig = SQSConsumerConfig.and(LoggerConfig)
  .and(S3Config)
  .and(FileManagerConfig)
  .and(SafeStorageApiConfig)
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
