import nodemailer from "nodemailer";
// a bit of a hack to import MailComposer from nodemailer that is not exported
// this is necessary because nodemailer does not support SesV2 (only SesV1)
// this solution is suggested in this issue:
// https://github.com/nodemailer/nodemailer/issues/1430#issuecomment-2046884660
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import {
  SESv2Client,
  SendEmailCommand,
  SendEmailCommandInput,
  TooManyRequestsException,
} from "@aws-sdk/client-sesv2";
import Mail from "nodemailer/lib/mailer/index.js";
import { Logger } from "../logging/index.js";
import { PecEmailManagerConfig } from "../config/pecEmailManagerConfig.js";
import { AWSSesConfig } from "../config/awsSesConfig.js";
import { delay } from "../utils/delay.js";

export type EmailManagerKind = "PEC" | "SES";

export type EmailManager = {
  kind: EmailManagerKind;
  send: (params: Mail.Options) => Promise<void>;
};

export type EmailManagerPEC = EmailManager & {
  kind: "PEC";
};

export type EmailManagerSES = EmailManager & {
  kind: "SES";
};

export function initPecEmailManager(
  config: PecEmailManagerConfig,
  rejectUnauthorized = true
): EmailManagerPEC {
  return {
    kind: "PEC",
    send: async (mailOptions: Mail.Options): Promise<void> => {
      const transporter = nodemailer.createTransport({
        host: config.smtpAddress,
        port: config.smtpPort,
        secure:
          config.smtpSecure !== undefined
            ? config.smtpSecure
            : config.smtpPort === 465,
        auth: {
          user: config.smtpUsername,
          pass: config.smtpPassword,
        },
        tls: {
          rejectUnauthorized,
        },
      });
      await transporter.sendMail(mailOptions);
    },
  };
}

export function initSesMailManager(
  awsConfig: AWSSesConfig,
  errorHandlingOptions?: {
    logger: Logger;
    // flag for specific error type forced to true it's the only one available for now
    skipTooManyRequestsError: true;
  }
): EmailManagerSES {
  const client = new SESv2Client({
    region: awsConfig.awsRegion,
    endpoint: awsConfig.awsSesEndpoint,
  });

  const maxRetries = 5;
  const initialDelay = 200;

  return {
    kind: "SES",
    send: async (mailOptions: Mail.Options): Promise<void> => {
      const rawMailData = await new MailComposer(mailOptions).compile().build();

      const input: SendEmailCommandInput = {
        Content: {
          Raw: { Data: rawMailData },
        },
      };

      const attemptSend = async (attempt: number): Promise<void> => {
        try {
          await client.send(new SendEmailCommand(input));
        } catch (err) {
          if (err instanceof TooManyRequestsException) {
            if (errorHandlingOptions?.skipTooManyRequestsError) {
              errorHandlingOptions.logger.warn(
                `Attempt ${attempt}: TooManyRequestsException encountered and skipped.`
              );
              return;
            }
            if (attempt < maxRetries) {
              const waitTime = initialDelay * Math.pow(2, attempt - 1);
              errorHandlingOptions?.logger.warn(
                `Attempt ${attempt} failed with TooManyRequestsException. Retrying in ${waitTime}ms...`
              );
              await delay(waitTime);
              return attemptSend(attempt + 1);
            } else {
              errorHandlingOptions?.logger.error(
                `All ${maxRetries} attempts failed. Last error: ${err.message}`
              );
              throw err;
            }
          } else {
            throw err;
          }
        }
      };

      return attemptSend(1);
    },
  };
}
