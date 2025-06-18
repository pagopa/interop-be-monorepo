import z from "zod";
import { NotificationTenantId, TenantId } from "../brandedIds.js";

export const EServiceConsumerNotificationConfig = z.object({
  newEServiceVersionPublished: z.boolean(),
});
export type EServiceConsumerNotificationConfig = z.infer<
  typeof EServiceConsumerNotificationConfig
>;

export const ConsumerNotificationConfig = z.object({
  eService: EServiceConsumerNotificationConfig,
});
export type ConsumerNotificationConfig = z.infer<
  typeof ConsumerNotificationConfig
>;

export const NotificationConfig = z.object({
  consumer: ConsumerNotificationConfig,
});
export type NotificationConfig = z.infer<typeof NotificationConfig>;

export const NotificationTenant = z.object({
  id: NotificationTenantId,
  tenantId: TenantId,
  config: NotificationConfig,
});
export type NotificationTenant = z.infer<typeof NotificationTenant>;
