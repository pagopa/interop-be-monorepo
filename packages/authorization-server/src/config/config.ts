import {
  CommonHTTPServiceConfig,
  FileManagerConfig,
  KafkaProducerConfig,
  RedisRateLimiterConfig,
  S3Config,
  AuthorizationServerTokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const AuthorizationServerConfig = CommonHTTPServiceConfig.and(
  RedisRateLimiterConfig
)
  .and(KafkaProducerConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(
    z
      .object({
        TOKEN_AUDITING_TOPIC: z.string(),
      })
      .transform((c) => ({
        tokenAuditingTopic: c.TOKEN_AUDITING_TOPIC,
      }))
  )
  .and(AuthorizationServerTokenGenerationConfig)
  .and(
    z
      .object({
        TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION: z.string(),
      })
      .transform((c) => ({
        tokenGenerationStatesTable:
          c.TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION,
      }))
  );

export type AuthorizationServerConfig = z.infer<
  typeof AuthorizationServerConfig
>;

export const config: AuthorizationServerConfig =
  AuthorizationServerConfig.parse(process.env);
