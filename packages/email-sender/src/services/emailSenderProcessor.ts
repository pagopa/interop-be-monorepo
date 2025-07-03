/* eslint-disable functional/no-let */
import { genericInternalError } from "pagopa-interop-models";
import { EachMessagePayload } from "kafkajs";
import { delay, EmailManagerSES, logger } from "pagopa-interop-commons";
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

      const {
        success,
        error,
        data: jsonPayload,
      } = EmailNotificationPayload.safeParse(
        JSON.parse(message.value.toString())
      );

      if (!success) {
        // Log and skip message
        loggerInstance.warn(
          `Error consuming message in partition ${partition} with offset ${message.offset}. Reason: ${error}`
        );
        return;
      }

      loggerInstance = logger({
        serviceName: "email-sender",
        correlationId: jsonPayload.correlationId,
      });
      loggerInstance.info(
        `Consuming message for partition ${partition} with offset ${message.offset}`
      );
      const mailOptions = {
        from: { name: sesSenderData.label, address: sesSenderData.mail },
        subject: jsonPayload.subject,
        to: [jsonPayload.address],
        html: jsonPayload.body,
      };

      let sent = false;
      while (!sent) {
        try {
          await sesEmailManager.send(mailOptions, loggerInstance);
          sent = true;
          loggerInstance.info(
            `Email sent for message in partition ${partition} with offset ${message.offset}.`
          );
          await delay(config.successDelayInMillis);
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

        const jsonPayload: EmailNotificationPayload = JSON.parse(
          message.value.toString()
        );
      }

      let jsonPayload: EmailNotificationPayload;
      let loggerInstance: Logger;
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
        throw genericInternalError(
          `Error consuming message in partition ${partition} with offset ${message.offset}. Reason: ${err}`
        );
      }

      let sent = false;
      let attempts = 0;
      while (!sent && attempts < config.maxAttempts) {
        try {
          attempts++;
          await sesEmailManager.send(mailOptions, loggerInstance);
          sent = true;
          loggerInstance.info(
            `Email sent for message in partition ${partition} with offset ${message.offset}.`
          );
        } catch (err) {
          switch (true) {
            case err instanceof LimitExceededException:
            case err instanceof TooManyRequestsException:
              await delay(config.retryDelayInMillis);
              break;
            default:
              loggerInstance.warn(
                `Email sending attempt failed for message in partition ${partition} with offset ${message.offset}. Reason: ${err} `
              );
              break;
          }
        }
      }

      if (!sent) {
        // Exceeded max number of attempts
        loggerInstance.warn(
          `Message in partition ${partition} with offset ${message.offset} was consumed, but no email was sent. Exceeded maximum number of attempts.`
        );
      }
    },
  };
}
