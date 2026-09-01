import {
  AuthorizationProcessServerConfig,
  KafkaConsumerConfig,
  PurposeTopicConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const ClientPurposeUpdaterConfig = AuthorizationProcessServerConfig.and(
  PurposeTopicConfig
)
  .and(TokenGenerationConfig)
  .and(KafkaConsumerConfig);

type ClientPurposeUpdaterConfig = z.infer<typeof ClientPurposeUpdaterConfig>;
export const config: ClientPurposeUpdaterConfig =
  ClientPurposeUpdaterConfig.parse(process.env);
