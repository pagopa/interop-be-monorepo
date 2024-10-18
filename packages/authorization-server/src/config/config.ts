import {
  CommonHTTPServiceConfig,
  FileManagerConfig,
  KafkaProducerConfig,
  PlatformStateWriterConfig,
  RedisRateLimiterConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

const AuthorizationServerConfig = CommonHTTPServiceConfig.and(
  RedisRateLimiterConfig
)
  .and(KafkaProducerConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(PlatformStateWriterConfig)
  .and(
    z
      .object({
        TOKEN_AUDITING_TOPIC: z.string(),
        // INTEROP_GENERATED_JWT_DETAILS_FALLBACK: z.string(),
      })
      .transform((c) => ({
        tokenAuditingTopic: c.TOKEN_AUDITING_TOPIC,
        // interopGeneratedJwtDetailsFallback:
        // c.INTEROP_GENERATED_JWT_DETAILS_FALLBACK,
      }))
  )
  .and(
    z
      .object({
        GENERATED_INTEROP_TOKEN_ALGORITHM: z.string(),
        GENERATED_INTEROP_TOKEN_KID: z.string(),
        GENERATED_INTEROP_TOKEN_ISSUER: z.string(),
        GENERATED_INTEROP_TOKEN_M2M_AUDIENCE: z.string(),
        GENERATED_INTEROP_TOKEN_M2M_DURATION_SECONDS: z.string(),
      })
      .transform((c) => ({
        generatedInteropTokenAlgorithm: c.GENERATED_INTEROP_TOKEN_ALGORITHM,
        generatedInteropTokenKid: c.GENERATED_INTEROP_TOKEN_KID,
        generatedInteropTokenIssuer: c.GENERATED_INTEROP_TOKEN_ISSUER,
        generatedInteropTokenM2MAudience:
          c.GENERATED_INTEROP_TOKEN_M2M_AUDIENCE,
        generatedInteropTokenM2MDurationSeconds: parseInt(
          c.GENERATED_INTEROP_TOKEN_M2M_DURATION_SECONDS,
          10
        ),
      }))
  )
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
