import {
  ReadModelSQLDbConfig,
  SelfCareClientConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const CreateDefaultUserNotificationConfigConfig = ReadModelSQLDbConfig.and(
  SelfCareClientConfig
).and(
  z
    .object({
      NOTIFICATION_CONFIG_PROCESS_URL: z.string(),
      INTERNAL_TOKEN: z.string(),
      INTEROP_PRODUCT: z.string(),
      NOTIFICATION_CONFIG_CALL_DELAY_MS: z.coerce.number().default(1000),
    })
    .transform((config) => ({
      notificationConfigProcessUrl: config.NOTIFICATION_CONFIG_PROCESS_URL,
      internalToken: config.INTERNAL_TOKEN,
      interopProduct: config.INTEROP_PRODUCT,
      notificationConfigCallDelayMs: config.NOTIFICATION_CONFIG_CALL_DELAY_MS,
    }))
);

export type CreateDefaultUserNotificationConfigConfig = z.infer<
  typeof CreateDefaultUserNotificationConfigConfig
>;

export const config: CreateDefaultUserNotificationConfigConfig =
  CreateDefaultUserNotificationConfigConfig.parse(process.env);
