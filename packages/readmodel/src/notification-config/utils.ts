import { z } from "zod";
import { NotificationConfig } from "pagopa-interop-models";

export const NotificationType = NotificationConfig.keyof();
export type NotificationType = z.infer<typeof NotificationType>;
