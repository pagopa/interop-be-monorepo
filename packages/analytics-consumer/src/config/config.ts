import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  CatalogTopicConfig,
  PurposeTopicConfig,
  AuthorizationTopicConfig,
  AttributeTopicConfig,
  TenantTopicConfig,
  DelegationTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const KpiEventConsumerConfig = KafkaConsumerConfig.and(
  CatalogTopicConfig
)
  .and(AgreementTopicConfig)
  .and(AttributeTopicConfig)
  .and(PurposeTopicConfig)
  .and(CatalogTopicConfig)
  .and(TenantTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(DelegationTopicConfig)
  .and(
    z
      .object({
        AUTHORIZATION_MANAGEMENT_URL: z.string(),
      })
      .transform((c) => ({
        authorizationManagementUrl: c.AUTHORIZATION_MANAGEMENT_URL,
      }))
  );

export type KpiEventConsumerConfig = z.infer<typeof KpiEventConsumerConfig>;

export const config: KpiEventConsumerConfig = KpiEventConsumerConfig.parse(
  process.env
);
