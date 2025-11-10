import {
  FileManagerConfig,
  KafkaProducerConfig,
  RedisRateLimiterConfig,
  S3Config,
  AuthorizationServerTokenGenerationConfig,
  HTTPServerConfig,
  LoggerConfig,
  ApplicationAuditProducerConfig,
  FeatureFlagImprovedProducerVerificationClaimsConfig,
  FeatureFlagClientAssertionStrictClaimsValidationConfig,
  DPoPConfig,
} from "pagopa-interop-commons";
import { z } from "zod";
import { ClientAssertionValidationConfig } from "pagopa-interop-client-assertion-validation";

const AuthorizationServerConfig = HTTPServerConfig.and(LoggerConfig)
  .and(RedisRateLimiterConfig)
  .and(KafkaProducerConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(ClientAssertionValidationConfig)
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
        KAFKA_PRODUCER_RECONNECT_BASE_INTERVAL_MS: z
          .string()
          .default("1000")
          .transform((s) => parseInt(s, 10)),
      })
      .transform((c) => ({
        tokenGenerationStatesTable:
          c.TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION,
        kafkaProducerReconnectBaseIntervalMs:
          c.KAFKA_PRODUCER_RECONNECT_BASE_INTERVAL_MS,
      }))
  )
  .and(ApplicationAuditProducerConfig)
  .and(FeatureFlagImprovedProducerVerificationClaimsConfig)
  .and(FeatureFlagClientAssertionStrictClaimsValidationConfig)
  .and(DPoPConfig);

export type AuthorizationServerConfig = z.infer<
  typeof AuthorizationServerConfig
>;

export const config: AuthorizationServerConfig =
  AuthorizationServerConfig.parse(process.env);
