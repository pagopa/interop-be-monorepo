import { z } from "zod";
import {
  FileManagerConfig,
  LoggerConfig,
  S3Config,
  SafeStorageApiConfig,
  DynamoDBClientConfig,
} from "pagopa-interop-commons";
import { SQSConsumerConfig } from "./sqsConfig.js";

const AuditSignerConfig = SQSConsumerConfig.and(FileManagerConfig)
  .and(S3Config)
  .and(LoggerConfig)
  .and(DynamoDBClientConfig)
  .and(SafeStorageApiConfig);

type AuditSignerConfig = z.infer<typeof AuditSignerConfig>;

export const config: AuditSignerConfig = AuditSignerConfig.parse(process.env);
