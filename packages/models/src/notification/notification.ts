import { z } from "zod";
import { UserId, TenantId, NotificationId } from "../brandedIds.js";

export const Notification = z.object({
  id: NotificationId,
  userId: UserId,
  tenantId: TenantId,
  body: z.string(),
  deepLink: z.string(),
  readAt: z.date().optional(),
  createdAt: z.date(),
});

export type Notification = z.infer<typeof Notification>;
