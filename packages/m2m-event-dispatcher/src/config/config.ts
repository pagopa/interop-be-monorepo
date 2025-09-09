import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  PurposeTopicConfig,
  CatalogTopicConfig,
  EServiceTemplateTopicConfig,
  DelegationTopicConfig,
  ReadModelSQLDbConfig,
  TenantTopicConfig,
  M2MEventSQLDbConfig,
  AttributeTopicConfig,
  AuthorizationTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const M2MEventsDispatcherConfig = KafkaConsumerConfig.and(
  AgreementTopicConfig
)
  .and(PurposeTopicConfig)
  .and(CatalogTopicConfig)
  .and(DelegationTopicConfig)
  .and(AttributeTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(EServiceTemplateTopicConfig)
  .and(TenantTopicConfig)
  .and(M2MEventSQLDbConfig)
  .and(ReadModelSQLDbConfig);

export type M2MEventsDispatcherConfig = z.infer<
  typeof M2MEventsDispatcherConfig
>;

export const config: M2MEventsDispatcherConfig =
  M2MEventsDispatcherConfig.parse(process.env);
