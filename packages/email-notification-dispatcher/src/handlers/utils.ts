import { EmailNotificationMessagePayload } from "pagopa-interop-models";

export function encodeEmailEvent(
  event: EmailNotificationMessagePayload
): string {
  return JSON.stringify({
    correlationId: event.correlationId,
    email: {
      subject: event.email.subject,
      body: event.email.body,
    },
    address: event.address,
  });
}
