import { genericInternalError } from "pagopa-interop-models";
import { EachMessagePayload } from "kafkajs";
import { EmailManagerSES, Logger } from "pagopa-interop-commons";
import Mail from "nodemailer/lib/mailer/index.js";
import { TooManyRequestsException } from "@aws-sdk/client-sesv2";

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

        // TODO: compose mail options. jsonPayload fields are still tentative, as
        // I don't know/remember what the message from the dispatcher looks like
        const mailOptions: Mail.Options = {
          from: { name: sesSenderData.label, address: sesSenderData.mail },
          subject: jsonPayload.subject,
          to: [jsonPayload.address],
          html: jsonPayload.html,
        };

        // TODO: try sending email <-- this requires some more info. It's too generic like this
        loggerInstance.info(`Sending email`);
        await sesEmailManager.send(mailOptions);
        loggerInstance.info(`Email sent`);
      } catch (err) {
        if (err instanceof TooManyRequestsException) {
          // Manage reaching rate limit...
          // Not sure how consuming an event works
        } else {
          throw genericInternalError(
            `Error consuming message in partition ${partition} with offset ${message.offset}. Reson: ${err}`
          );
        }
      }
    },
  };
}
