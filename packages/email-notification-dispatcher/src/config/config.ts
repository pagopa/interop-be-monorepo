import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  PurposeTopicConfig,
  CatalogTopicConfig,
  FeatureFlagSQLConfig,
  ReadModelSQLDbConfig,
  KafkaProducerConfig,
  EmailSenderTopicConfig,
  DelegationTopicConfig,
  AttributeTopicConfig,
  AuthorizationTopicConfig,
  UserSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const EmailNotificationDispatcherConfig = KafkaConsumerConfig.and(
  KafkaProducerConfig
)
  .and(AgreementTopicConfig)
  .and(PurposeTopicConfig)
  .and(CatalogTopicConfig)
  .and(DelegationTopicConfig)
  .and(AttributeTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(FeatureFlagSQLConfig)
  .and(ReadModelSQLDbConfig)
  .and(UserSQLDbConfig)
  .and(EmailSenderTopicConfig)
  .and(
    z
      .object({ INTEROP_FE_BASE_URL: z.string() })
      .transform((c) => ({ interopFeBaseUrl: c.INTEROP_FE_BASE_URL }))
  );

export type EmailNotificationDispatcherConfig = z.infer<
  typeof EmailNotificationDispatcherConfig
>;

export const config: EmailNotificationDispatcherConfig =
  EmailNotificationDispatcherConfig.parse(process.env);
