import { InAppNotificationDBConfig } from "pagopa-interop-commons";
import { z } from "zod";

const InAppNotificationCleanerConfig = InAppNotificationDBConfig.and(
  z.object({
    DELETE_OLDER_THAN_DAYS: z.coerce.number().default(90),
  })
);

type InAppNotificationCleanerConfig = z.infer<
  typeof InAppNotificationCleanerConfig
>;

export const config: InAppNotificationCleanerConfig =
  InAppNotificationCleanerConfig.parse(process.env);
