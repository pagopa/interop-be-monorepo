import {
  AgreementTopicConfig,
  TokenGenerationConfig,
  KafkaConsumerConfig,
  CatalogTopicConfig,
  ReadModelDbConfig,
  PurposeTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const AuthorizationUpdaterConfig = KafkaConsumerConfig.and(
  CatalogTopicConfig
)
  .and(AgreementTopicConfig)
  .and(PurposeTopicConfig)
  .and(TokenGenerationConfig)
  .and(ReadModelDbConfig)
  .and(
    z
      .object({
        AUTHORIZATION_MANAGEMENT_URL: z.string(),
      })
      .transform((c) => ({
        authorizationManagementUrl: c.AUTHORIZATION_MANAGEMENT_URL,
      }))
  );

export type AuthorizationUpdaterConfig = z.infer<
  typeof AuthorizationUpdaterConfig
>;

export const config: AuthorizationUpdaterConfig =
  AuthorizationUpdaterConfig.parse(process.env);
