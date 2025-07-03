import { QueueMessage } from "pagopa-interop-commons";
import { z } from "zod";
import { decodeSQSMessageError } from "pagopa-interop-models";
import { Message } from "@aws-sdk/client-sqs";
import { ApplicationAuditEvent } from "./application-audit.js";

export const ApplicationAuditEventMessageSchema = z.object({
  value: z.preprocess((v) => {
    if (v != null) {
      try {
        const parsed = JSON.parse(v.toString());
        const queueMessage = QueueMessage.parse(parsed);
        return queueMessage.payload;
      } catch (err) {
        return null;
      }
    }
    return null;
  }, ApplicationAuditEvent),
});

export function decodeSQSMessage(message: Message): ApplicationAuditEvent {
  const parsed = ApplicationAuditEventMessageSchema.safeParse({
    value: message.Body,
  });

  if (!parsed.success) {
    throw decodeSQSMessageError(message.MessageId, parsed.error);
  }

  return parsed.data.value;
}
