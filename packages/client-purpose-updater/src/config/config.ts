import {
  APIEndpoint,
  KafkaConsumerConfig,
  PurposeTopicConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const AuthorizationProcessServerConfig = z
  .object({
    AUTHORIZATION_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    authorizationUrl: c.AUTHORIZATION_PROCESS_URL,
  }));

const ClientPurposeUpdaterConfig = AuthorizationProcessServerConfig.and(
  PurposeTopicConfig
)
  .and(TokenGenerationConfig)
  .and(KafkaConsumerConfig);

type ClientPurposeUpdaterConfig = z.infer<typeof ClientPurposeUpdaterConfig>;
export const config: ClientPurposeUpdaterConfig =
  ClientPurposeUpdaterConfig.parse(process.env);
