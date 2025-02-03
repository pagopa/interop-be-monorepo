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

export const AnalyticsConsumerConfig = KafkaConsumerConfig.and(
  CatalogTopicConfig
)
  .and(AgreementTopicConfig)
  .and(AttributeTopicConfig)
  .and(PurposeTopicConfig)
  .and(CatalogTopicConfig)
  .and(TenantTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(DelegationTopicConfig);

export type AnalyticsConsumerConfig = z.infer<typeof AnalyticsConsumerConfig>;

export const config: AnalyticsConsumerConfig = AnalyticsConsumerConfig.parse(
  process.env
);
