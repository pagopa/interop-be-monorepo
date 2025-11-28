import { M2MEventSQLDbConfig } from "pagopa-interop-commons";
import { z } from "zod";

const M2MEventCleanerConfig = M2MEventSQLDbConfig.and(
  z
    .object({
      DELETE_OLDER_THAN_DAYS: z.coerce.number(),
    })
    .transform((config) => ({
      deleteOlderThanDays: config.DELETE_OLDER_THAN_DAYS,
    }))
);

export type M2MEventCleanerConfig = z.infer<typeof M2MEventCleanerConfig>;

export const config: M2MEventCleanerConfig = M2MEventCleanerConfig.parse(
  process.env
);
