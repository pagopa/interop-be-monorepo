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

export const DomainsAnalyticsWriterConfig = KafkaConsumerConfig.and(
  CatalogTopicConfig,
)
  .and(AgreementTopicConfig)
  .and(AttributeTopicConfig)
  .and(PurposeTopicConfig)
  .and(CatalogTopicConfig)
  .and(TenantTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(DelegationTopicConfig);

export type DomainsAnalyticsWriterConfig = z.infer<
  typeof DomainsAnalyticsWriterConfig
>;

export const config: DomainsAnalyticsWriterConfig =
  DomainsAnalyticsWriterConfig.parse(process.env);
