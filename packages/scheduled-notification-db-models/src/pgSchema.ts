import { pgSchema } from "drizzle-orm/pg-core";
import { ScheduledNotificationDBConfig } from "pagopa-interop-commons";

const config = ScheduledNotificationDBConfig.parse(process.env);

export const scheduledNotificationSchema = pgSchema(
  config.scheduledNotificationDBSchema
);
