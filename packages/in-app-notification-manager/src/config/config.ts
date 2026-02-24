import {
  ApplicationAuditProducerConfig,
  CommonHTTPServiceConfig,
} from "pagopa-interop-commons";
import { z } from "zod";
import { InAppNotificationDBConfig } from "pagopa-interop-commons";
import { FeatureFlagNotificationConfig } from "pagopa-interop-commons";

const InAppNotificationManagerConfig = CommonHTTPServiceConfig.and(
  ApplicationAuditProducerConfig
)
  .and(InAppNotificationDBConfig)
  .and(FeatureFlagNotificationConfig);

type InAppNotificationManagerConfig = z.infer<
  typeof InAppNotificationManagerConfig
>;

export const config: InAppNotificationManagerConfig =
  InAppNotificationManagerConfig.parse(process.env);
