import { z } from "zod";
import { CorrelationId } from "../brandedIds.js";
import { Email, EmailAddress } from "./email.js";

export const EmailNotificationMessagePayload = z.object({
  correlationId: CorrelationId,
  address: EmailAddress,
  email: Email,
});
export type EmailNotificationMessagePayload = z.infer<
  typeof EmailNotificationMessagePayload
>;
