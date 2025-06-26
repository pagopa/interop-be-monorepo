/* eslint-disable functional/no-let */
import { genericInternalError } from "pagopa-interop-models";
import { EachMessagePayload } from "kafkajs";
import { delay, EmailManagerSES, Logger } from "pagopa-interop-commons";
import Mail from "nodemailer/lib/mailer/index.js";
import { TooManyRequestsException } from "@aws-sdk/client-sesv2";
import { config } from "../config/config.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function emailSenderProcessorBuilder(
  loggerInstance: Logger,
  sesEmailManager: EmailManagerSES,
  sesSenderData: { label: string; mail: string }
) {
  return {
    async processMessage({
      message,
      partition,
    }: EachMessagePayload): Promise<void> {
      let attempts: number = 0;
      let sent = false;
      while (!sent && attempts < config.maxAttempts) {
        try {
          loggerInstance.info(
            `Consuming message for partition ${partition} with offset ${message.offset}`
          );

          if (!message.value) {
            loggerInstance.warn(
              `Empty message for partition ${partition} with offset ${message.offset}`
            );
            return;
          }

          const jsonPayload = JSON.parse(message.value.toString());

          const mailOptions: Mail.Options = {
            from: { name: sesSenderData.label, address: sesSenderData.mail },
            subject: jsonPayload.subject,
            to: [jsonPayload.address],
            html: jsonPayload.body,
          };

          loggerInstance.info(`Sending email: ${jsonPayload}`);
          attempts++;
          await sesEmailManager.send(mailOptions);
          sent = true;
          loggerInstance.info(`Email sent: ${jsonPayload}`);
        } catch (err) {
          if (err instanceof TooManyRequestsException) {
            await delay(config.retryDelayInMillis);
          } else {
            throw genericInternalError(
              `Error consuming message in partition ${partition} with offset ${message.offset}. Reson: ${err}`
            );
          }
        }
      }
      if (!sent) {
        throw genericInternalError(
          `Error consuming message in partition ${partition} with offset ${message.offset}. Reson: too many attempts`
        );
      }
    },
  };
}
