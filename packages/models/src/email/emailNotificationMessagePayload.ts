import { CorrelationId } from "../brandedIds.js";
import { Email, EmailAddress } from "./email.js";

export type EmailNotificationMessagePayload = {
  correlationId: CorrelationId;
  address: EmailAddress;
  email: Email;
};
