import { match } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import { EmailNotificationMessagePayload } from "pagopa-interop-models";

type Producer = {
  send: (args: { messages: Array<{ value: string }> }) => Promise<unknown>;
};

export const encodeEmailEvent = (
  event: EmailNotificationMessagePayload
): string =>
  JSON.stringify({
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

export const emailKafkaSinkBuilder = (producer: Producer, log: Logger) => ({
  async sendEmails(payloads: EmailNotificationMessagePayload[]): Promise<void> {
    if (payloads.length === 0) {
      return;
    }
    try {
      await producer.send({
        messages: payloads.map((p) => ({ value: encodeEmailEvent(p) })),
      });
    } catch (err) {
      log.error(
        `Error sending ${payloads.length} email messages to Kafka. Affected correlationIds: ${payloads
          .map((p) => p.correlationId)
          .join(", ")} - error: ${String(err)}`
      );
      throw err;
    }
  },
});
