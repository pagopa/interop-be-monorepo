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
  FeatureFlagAsyncExchangeConfig,
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
