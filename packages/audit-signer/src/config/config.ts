import {
  FileManagerConfig,
  LoggerConfig,
  S3Config,
  SafeStorageApiConfig,
  DynamoDBClientConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

import { SQSConsumerConfig } from "./sqsConfig.js";

const AuditSignerConfig = SQSConsumerConfig.and(FileManagerConfig)
  .and(S3Config)
  .and(LoggerConfig)
  .and(DynamoDBClientConfig)
  .and(SafeStorageApiConfig)
  .and(
    z
      .object({
        FILE_KIND: z.enum(["VOUCHER_AUDIT", "M2M_VOUCHER_AUDIT"]),
      })
      .transform((c) => ({
        fileKind: c.FILE_KIND,
      }))
  );

type AuditSignerConfig = z.infer<typeof AuditSignerConfig>;

export const config: AuditSignerConfig = AuditSignerConfig.parse(process.env);
