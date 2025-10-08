import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  PurposeTopicConfig,
  CatalogTopicConfig,
  ReadModelSQLDbConfig,
  KafkaProducerConfig,
  EmailSenderTopicConfig,
  DelegationTopicConfig,
  AuthorizationTopicConfig,
  UserSQLDbConfig,
  TenantTopicConfig,
  NotificationTypeBlocklistConfig,
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
  .and(UserSQLDbConfig)
  .and(EmailSenderTopicConfig)
  .and(NotificationTypeBlocklistConfig);

export type EmailNotificationDispatcherConfig = z.infer<
  typeof EmailNotificationDispatcherConfig
>;

export const config: EmailNotificationDispatcherConfig =
  EmailNotificationDispatcherConfig.parse(process.env);
