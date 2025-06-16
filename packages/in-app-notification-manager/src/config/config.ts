import { CommonHTTPServiceConfig } from "pagopa-interop-commons";
import { z } from "zod";

const InAppNotificationManagerConfig = CommonHTTPServiceConfig;

export type InAppNotificationManagerConfig = z.infer<
  typeof InAppNotificationManagerConfig
>;

export const config: InAppNotificationManagerConfig =
  InAppNotificationManagerConfig.parse(process.env);
