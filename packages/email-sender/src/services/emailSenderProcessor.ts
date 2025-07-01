import { genericInternalError } from "pagopa-interop-models";
import { EachMessagePayload } from "kafkajs";
import { EmailManagerSES, logger } from "pagopa-interop-commons";
import Mail from "nodemailer/lib/mailer/index.js";
import { EmailNotificationPayload } from "../model/emailNotificationPayload.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function emailSenderProcessorBuilder(
  sesSenderData: {
    label: string;
    mail: string;
  },
  sesEmailManager: EmailManagerSES
) {
  return {
    async processMessage({
      message,
      partition,
    }: EachMessagePayload): Promise<void> {
      const serviceName = "email-sender";
      try {
        if (!message.value) {
          throw genericInternalError(
            `Empty message for partition ${partition} with offset ${message.offset}`
          );
        }

        const jsonPayload: EmailNotificationPayload = JSON.parse(
          message.value.toString()
        );

        const loggerInstance = logger({
          serviceName,
          correlationId: jsonPayload.correlationId,
        });

        loggerInstance.info(
          `Consuming message for partition ${partition} with offset ${message.offset}`
        );

        const mailOptions: Mail.Options = {
          from: { name: sesSenderData.label, address: sesSenderData.mail },
          subject: jsonPayload.subject,
          to: [jsonPayload.address],
          html: jsonPayload.body,
        };

        loggerInstance.info(
          `Sending email. CorrelationId: ${jsonPayload.correlationId}`
        );
        await sesEmailManager.send(mailOptions);
        loggerInstance.info(
          `Email sent: ${jsonPayload}. CorrelationId: ${jsonPayload.correlationId}`
        );
      } catch (err) {
        throw genericInternalError(
          `Error consuming message in partition ${partition} with offset ${message.offset}. Reason: ${err}`
        );
      }
    },
  };
}
