import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  PurposeTopicConfig,
  CatalogTopicConfig,
  DelegationTopicConfig,
  ReadModelSQLDbConfig,
  InAppNotificationDBConfig,
  AuthorizationTopicConfig,
  TenantTopicConfig,
  EServiceTemplateTopicConfig,
  UserSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const InAppNotificationDispatcherConfig = KafkaConsumerConfig.and(
  AgreementTopicConfig
)
  .and(PurposeTopicConfig)
  .and(CatalogTopicConfig)
  .and(DelegationTopicConfig)
  .and(TenantTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(EServiceTemplateTopicConfig)
  .and(InAppNotificationDBConfig)
  .and(ReadModelSQLDbConfig)
  .and(UserSQLDbConfig);

export type InAppNotificationDispatcherConfig = z.infer<
  typeof InAppNotificationDispatcherConfig
>;

export const config: InAppNotificationDispatcherConfig =
  InAppNotificationDispatcherConfig.parse(process.env);
