import { pgSchema } from "drizzle-orm/pg-core";
import { InAppNotificationDBConfig } from "pagopa-interop-commons";

const config = InAppNotificationDBConfig.parse(process.env);

export const notificationSchema = pgSchema(config.inAppNotificationDBSchema);
