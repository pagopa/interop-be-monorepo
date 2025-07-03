import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  ReadModelDbConfig,
  PurposeTopicConfig,
  CatalogTopicConfig,
  ReadModelSQLDbConfig,
  InAppNotificationDBConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const InAppNotificationDispatcherConfig = KafkaConsumerConfig.and(
  ReadModelDbConfig
)
  .and(AgreementTopicConfig)
  .and(PurposeTopicConfig)
  .and(CatalogTopicConfig)
  .and(InAppNotificationDBConfig)
  .and(ReadModelSQLDbConfig)
  .and(
    z
      .object({ INTEROP_FE_BASE_URL: z.string() })
      .transform((c) => ({ interopFeBaseUrl: c.INTEROP_FE_BASE_URL }))
  );

export type InAppNotificationDispatcherConfig = z.infer<
  typeof InAppNotificationDispatcherConfig
>;

export const config: InAppNotificationDispatcherConfig =
  InAppNotificationDispatcherConfig.parse(process.env);
