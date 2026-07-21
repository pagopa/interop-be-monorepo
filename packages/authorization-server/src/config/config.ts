import { ClientAssertionValidationConfig } from "pagopa-interop-client-assertion-validation";
import {
  FileManagerConfig,
  KafkaProducerConfig,
  RedisRateLimiterConfig,
  AuthorizationServerTokenGenerationConfig,
  HTTPServerConfig,
  LoggerConfig,
  ApplicationAuditProducerConfig,
  FeatureFlagImprovedProducerVerificationClaimsConfig,
  FeatureFlagClientAssertionStrictClaimsValidationConfig,
  FeatureFlagAsyncExchangeConfig,
  DPoPConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const S3AuditFallbackConfig = z
  .object({
    S3_BUCKET_CONSUMER_TOKEN_AUDIT_FALLBACK: z.string(),
    S3_BUCKET_API_TOKEN_AUDIT_FALLBACK: z.string(),
  })
  .transform((c) => ({
    s3BucketConsumerTokenAuditFallback:
      c.S3_BUCKET_CONSUMER_TOKEN_AUDIT_FALLBACK,
    s3BucketApiTokenAuditFallback: c.S3_BUCKET_API_TOKEN_AUDIT_FALLBACK,
  }));

const AuthorizationServerConfig = HTTPServerConfig.and(LoggerConfig)
  .and(RedisRateLimiterConfig)
  .and(KafkaProducerConfig)
  .and(FileManagerConfig)
  .and(S3AuditFallbackConfig)
  .and(ClientAssertionValidationConfig)
  .and(
    z
      .object({
        CONSUMER_TOKEN_AUDITING_TOPIC: z.string(),
        API_TOKEN_AUDITING_TOPIC: z.string(),
      })
      .transform((c) => ({
        consumerTokenAuditingTopic: c.CONSUMER_TOKEN_AUDITING_TOPIC,
        apiTokenAuditingTopic: c.API_TOKEN_AUDITING_TOPIC,
      }))
  )
  .and(AuthorizationServerTokenGenerationConfig)
  .and(
    z
      .object({
        TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION: z.string(),
        TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM: z.string(),
        TOKEN_GENERATION_READMODEL_TABLE_NAME_INTERACTIONS: z.string(),
        INTERACTION_TTL_EPSILON_SECONDS: z.coerce.number(),
        PRODUCER_KEYCHAIN_PLATFORM_STATES_TABLE_NAME: z.string(),
      })
      .transform((c) => ({
        tokenGenerationStatesTable:
          c.TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION,
        platformStatesTable: c.TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM,
        interactionsTable: c.TOKEN_GENERATION_READMODEL_TABLE_NAME_INTERACTIONS,
        interactionTtlEpsilonSeconds: c.INTERACTION_TTL_EPSILON_SECONDS,
        producerKeychainPlatformStatesTable:
          c.PRODUCER_KEYCHAIN_PLATFORM_STATES_TABLE_NAME,
      }))
  )
  .and(ApplicationAuditProducerConfig)
  .and(FeatureFlagImprovedProducerVerificationClaimsConfig)
  .and(FeatureFlagClientAssertionStrictClaimsValidationConfig)
  .and(FeatureFlagAsyncExchangeConfig)
  .and(DPoPConfig);

type AuthorizationServerConfig = z.infer<typeof AuthorizationServerConfig>;

export const config: AuthorizationServerConfig =
  AuthorizationServerConfig.parse(process.env);
