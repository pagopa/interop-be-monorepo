import { ScheduledNotificationDBConfig } from "pagopa-interop-commons";
import { z } from "zod";

const ScheduledNotificationCleanerConfig = ScheduledNotificationDBConfig.and(
  z.object({
    DELETE_OLDER_THAN_DAYS: z.coerce.number().default(90),
  })
);

type ScheduledNotificationCleanerConfig = z.infer<
  typeof ScheduledNotificationCleanerConfig
>;

export const config: ScheduledNotificationCleanerConfig =
  ScheduledNotificationCleanerConfig.parse(process.env);
