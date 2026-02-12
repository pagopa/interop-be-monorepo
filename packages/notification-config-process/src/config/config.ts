import {
  CommonHTTPServiceConfig,
  EventStoreConfig,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
  FeatureFlagNotificationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const NotificationConfigProcessConfig = CommonHTTPServiceConfig.and(
  EventStoreConfig
)
  .and(ApplicationAuditProducerConfig)
  .and(ReadModelSQLDbConfig)
  .and(FeatureFlagNotificationConfig);

type NotificationConfigProcessConfig = z.infer<
  typeof NotificationConfigProcessConfig
>;

export const config: NotificationConfigProcessConfig =
  NotificationConfigProcessConfig.parse(process.env);
