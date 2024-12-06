import {
  APIEndpoint,
  AuthorizationTopicConfig,
  CommonHTTPServiceConfig,
  KafkaConsumerConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const AuthorizationProcessServerConfig = z
  .object({
    AUTHORIZATION_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    authorizationUrl: c.AUTHORIZATION_PROCESS_URL,
  }));
export type AuthorizationProcessServerConfig = z.infer<
  typeof AuthorizationProcessServerConfig
>;

const AuthorizationProcessConfig = CommonHTTPServiceConfig.and(
  AuthorizationProcessServerConfig
)
  .and(AuthorizationTopicConfig)
  .and(TokenGenerationConfig)
  .and(KafkaConsumerConfig);

export type AuthorizationProcessConfig = z.infer<
  typeof AuthorizationProcessConfig
>;
export const config: AuthorizationProcessConfig =
  AuthorizationProcessConfig.parse(process.env);
