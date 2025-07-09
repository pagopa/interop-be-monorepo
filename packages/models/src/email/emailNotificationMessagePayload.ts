import { CorrelationId, Email, EmailAddress } from "../index.js";

export type EmailNotificationMessagePayload = {
  correlationId: CorrelationId;
  address: EmailAddress;
  email: Email;
};
