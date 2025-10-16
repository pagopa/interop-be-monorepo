import { z } from "zod";
import { CorrelationId, TenantId, UserId } from "../brandedIds.js";
import { Email, EmailAddress } from "./email.js";

const EmailNotificationMessagePayloadBase = z.object({
  correlationId: CorrelationId,
  email: Email,
  tenantId: TenantId,
});

const EmailNotificationMessagePayloadUser =
  EmailNotificationMessagePayloadBase.extend({
    type: z.literal("User"),
    userId: UserId,
  });

const EmailNotificationMessagePayloadTenant =
  EmailNotificationMessagePayloadBase.extend({
    type: z.literal("Tenant"),
    address: EmailAddress,
  });

export const EmailNotificationMessagePayload = z.discriminatedUnion("type", [
  EmailNotificationMessagePayloadUser,
  EmailNotificationMessagePayloadTenant,
]);
export type EmailNotificationMessagePayload = z.infer<
  typeof EmailNotificationMessagePayload
>;
