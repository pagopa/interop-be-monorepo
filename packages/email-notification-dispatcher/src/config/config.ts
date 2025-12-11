import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  PurposeTopicConfig,
  CatalogTopicConfig,
  ReadModelSQLDbConfig,
  KafkaProducerConfig,
  EmailDispatchTopicConfig,
  DelegationTopicConfig,
  AuthorizationTopicConfig,
  TenantTopicConfig,
  NotificationTypeBlocklistConfig,
  EServiceTemplateTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const EmailNotificationDispatcherConfig = KafkaConsumerConfig.and(
  KafkaProducerConfig
)
  .and(AgreementTopicConfig)
  .and(PurposeTopicConfig)
  .and(CatalogTopicConfig)
  .and(DelegationTopicConfig)
  .and(TenantTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(ReadModelSQLDbConfig)
  .and(EmailDispatchTopicConfig)
  .and(NotificationTypeBlocklistConfig)
  .and(EServiceTemplateTopicConfig);

export type EmailNotificationDispatcherConfig = z.infer<
  typeof EmailNotificationDispatcherConfig
>;

export const config: EmailNotificationDispatcherConfig =
  EmailNotificationDispatcherConfig.parse(process.env);
