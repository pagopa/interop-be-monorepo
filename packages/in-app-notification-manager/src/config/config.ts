import {
  ApplicationAuditProducerConfig,
  CommonHTTPServiceConfig,
} from "pagopa-interop-commons";
import { InAppNotificationDBConfig } from "pagopa-interop-commons";
import { z } from "zod";

const InAppNotificationManagerConfig = CommonHTTPServiceConfig.and(
  ApplicationAuditProducerConfig
).and(InAppNotificationDBConfig);

type InAppNotificationManagerConfig = z.infer<
  typeof InAppNotificationManagerConfig
>;

export const config: InAppNotificationManagerConfig =
  InAppNotificationManagerConfig.parse(process.env);
