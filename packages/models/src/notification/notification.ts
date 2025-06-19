import { z } from "zod";
import { UserId, TenantId } from "../brandedIds.js";

export const Notification = z.object({
  id: z.string(),
  userId: UserId,
  tenantId: TenantId,
  body: z.string(),
  deepLink: z.string(),
  readAt: z.date().optional(),
  createdAt: z.date(),
});

export type Notification = z.infer<typeof Notification>;
