import {
  CommonHTTPServiceConfig,
  RedisRateLimiterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const AuthorizationServerConfig = CommonHTTPServiceConfig.and(
  RedisRateLimiterConfig
).and(
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
      generatedInteropTokenM2MAudience: c.GENERATED_INTEROP_TOKEN_M2M_AUDIENCE,
      generatedInteropTokenM2MDurationSeconds: parseInt(
        c.GENERATED_INTEROP_TOKEN_M2M_DURATION_SECONDS,
        10
      ),
    }))
);

export type AuthorizationServerConfig = z.infer<
  typeof AuthorizationServerConfig
>;

export const config: AuthorizationServerConfig =
  AuthorizationServerConfig.parse(process.env);
