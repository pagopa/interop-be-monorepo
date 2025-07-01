import { CorrelationId } from "pagopa-interop-models";

export type EmailNotificationPayload = {
  correlationId: CorrelationId;
  subject: string;
  address: string;
  body: string;
};
