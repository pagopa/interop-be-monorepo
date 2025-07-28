import { CorrelationId } from "pagopa-interop-models";
import { z } from "zod";

export const EmailNotificationPayload = z.object({
  correlationId: CorrelationId,
  subject: z.string().min(1),
  address: z.string().email(),
  body: z.string().min(1),
});

export type EmailNotificationPayload = z.infer<typeof EmailNotificationPayload>;
