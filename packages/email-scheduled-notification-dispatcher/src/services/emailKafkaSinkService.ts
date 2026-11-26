import { Logger } from "pagopa-interop-commons";
import { EmailNotificationMessagePayload } from "pagopa-interop-models";
import { encodeEmailEvent } from "pagopa-interop-notification-commons";

type Producer = {
  send: (args: { messages: Array<{ value: string }> }) => Promise<unknown>;
};

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
