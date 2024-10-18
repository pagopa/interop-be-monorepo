import {
  FileManagerConfig,
  KafkaBatchConsumerConfig,
  LoggerConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

export const TokenDetailsPersisterConfig = FileManagerConfig.and(S3Config)
  .and(KafkaBatchConsumerConfig)
  .and(LoggerConfig)
  .and(
    z
      .object({
        TOKEN_AUDITING_TOPIC: z.string(),
        // INTEROP_GENERATED_JWT_AUDITING_BUCKET: z.string(),
      })
      .transform((c) => ({
        tokenAuditingTopic: c.TOKEN_AUDITING_TOPIC,
        // interopGeneratedJwtAuditingBucket:
        //   c.INTEROP_GENERATED_JWT_AUDITING_BUCKET,
      }))
  );

export type TokenDetailsPersisterConfig = z.infer<
  typeof TokenDetailsPersisterConfig
>;

export const config: TokenDetailsPersisterConfig =
  TokenDetailsPersisterConfig.parse(process.env);
