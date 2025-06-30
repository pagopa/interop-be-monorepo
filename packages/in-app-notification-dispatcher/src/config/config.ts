import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  ReadModelDbConfig,
  PurposeTopicConfig,
  CatalogTopicConfig,
  FeatureFlagSQLConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const InAppNotificationDispatcherConfig = KafkaConsumerConfig.and(
  ReadModelDbConfig
)
  .and(AgreementTopicConfig)
  .and(PurposeTopicConfig)
  .and(CatalogTopicConfig)
  .and(FeatureFlagSQLConfig)
  .and(ReadModelSQLDbConfig.optional());

export type InAppNotificationDispatcherConfig = z.infer<
  typeof InAppNotificationDispatcherConfig
>;

export const config: InAppNotificationDispatcherConfig =
  InAppNotificationDispatcherConfig.parse(process.env);
