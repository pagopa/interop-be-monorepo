/* eslint-disable functional/no-let */
import { genericInternalError } from "pagopa-interop-models";
import { EachMessagePayload } from "kafkajs";
import { delay, EmailManagerSES, logger } from "pagopa-interop-commons";
import Mail from "nodemailer/lib/mailer/index.js";
import { TooManyRequestsException } from "@aws-sdk/client-sesv2";
import { EmailNotificationPayload } from "../model/emailNotificationPayload.js";
import { config } from "../config/config.js";

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
      let loggerInstance = logger({ serviceName: "email-sender" });

      if (!message.value) {
        // Log and skip message
        loggerInstance.info(
          `Empty message for partition ${partition} with offset ${message.offset}`
        );
        return;
      }

      let jsonPayload: EmailNotificationPayload;
      let mailOptions: Mail.Options;
      try {
        jsonPayload = JSON.parse(message.value.toString());
        loggerInstance = logger({
          serviceName: "email-sender",
          correlationId: jsonPayload.correlationId,
        });
        loggerInstance.info(
          `Consuming message for partition ${partition} with offset ${message.offset}`
        );
        mailOptions = {
          from: { name: sesSenderData.label, address: sesSenderData.mail },
          subject: jsonPayload.subject,
          to: [jsonPayload.address],
          html: jsonPayload.body,
        };
      } catch (err) {
        // Log and skip message
        loggerInstance.info(
          `Error consuming message in partition ${partition} with offset ${message.offset}. Reason: ${err}`
        );
        return;
      }

      let sent = false;
      while (!sent) {
        try {
          await sesEmailManager.send(mailOptions, loggerInstance);
          sent = true;
          loggerInstance.info(
            `Email sent for message in partition ${partition} with offset ${message.offset}.`
          );
        } catch (err) {
          if (err instanceof TooManyRequestsException) {
            loggerInstance.error(
              `Email sending attempt failed for message in partition ${partition} with offset ${message.offset}. Reason: ${err}. Attempting retry in ${config.retryDelayInMillis}ms`
            );
            await delay(config.retryDelayInMillis);
          } else {
            throw genericInternalError(
              `Email sending attempt failed for message in partition ${partition} with offset ${message.offset}. Reason: ${err} `
            );
          }
        }
      }
    },
  };
}
