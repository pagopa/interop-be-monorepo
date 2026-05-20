import { EmailNotificationMessagePayload } from "pagopa-interop-models";
import { match } from "ts-pattern";

export function encodeEmailEvent(
  event: EmailNotificationMessagePayload
): string {
  return JSON.stringify({
    correlationId: event.correlationId,
    email: {
      subject: event.email.subject,
      body: event.email.body,
    },
    tenantId: event.tenantId,
    ...match(event)
      .with({ type: "User" }, ({ type, userId }) => ({ type, userId }))
      .with({ type: "Tenant" }, ({ type, address }) => ({ type, address }))
      .exhaustive(),
  });
}
