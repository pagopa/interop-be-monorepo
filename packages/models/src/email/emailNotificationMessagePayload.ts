import { z } from "zod";

import { ContactId, CorrelationId, TenantId, UserId } from "../brandedIds.js";
import { Email, EmailAddress } from "./email.js";

const EmailNotificationMessagePayloadBase = z.object({
  correlationId: CorrelationId,
  email: Email,
  tenantId: TenantId,
});

export const EmailNotificationRecipientPayload = z.union([
  z.object({ type: z.literal("User"), userId: UserId }),
  z.object({
    type: z.literal("Tenant"),
    contactId: ContactId,
    address: z.never().optional(),
  }),
  // During cutover, producers may still see a legacy tenant and Kafka may
  // contain notifications that were queued before the contact was migrated.
  z.object({
    type: z.literal("Tenant"),
    address: EmailAddress,
    contactId: z.never().optional(),
  }),
]);
export type EmailNotificationRecipientPayload = z.infer<
  typeof EmailNotificationRecipientPayload
>;

export const EmailNotificationMessagePayload =
  EmailNotificationMessagePayloadBase.and(EmailNotificationRecipientPayload);
export type EmailNotificationMessagePayload = z.infer<
  typeof EmailNotificationMessagePayload
>;
