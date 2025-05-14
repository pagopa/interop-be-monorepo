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
import { PecEmailManagerConfig } from "../config/index.js";
import { AWSSesConfig } from "../config/index.js";

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
        // If true the connection will use TLS when connecting to server.
        // If false (the default) then TLS is used if server supports the STARTTLS extension.
        // In most cases set this value to true if you are connecting to port 465. For port 587 or 25 keep it false
        secure:
          config.smtpSecure !== undefined
            ? config.smtpSecure
            : config.smtpPort === 465,
        auth: {
          user: config.smtpUsername,
          pass: config.smtpPassword,
        },
        tls: {
          // do not fail on invalid certs
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

  return {
    kind: "SES",
    send: async (mailOptions: Mail.Options): Promise<void> => {
      const rawMailData = await new MailComposer(mailOptions).compile().build();

      const input: SendEmailCommandInput = {
        Content: {
          Raw: { Data: rawMailData },
        },
      };

      try {
        await client.send(new SendEmailCommand(input));
      } catch (err) {
        if (!errorHandlingOptions?.skipTooManyRequestsError) {
          throw err;
        }

        /*
          Temporary Hotfix: https://pagopa.atlassian.net/browse/PIN-6514 
          We want to avoid treating the TooManyRequestsException as a fatal error 
          when the rate limit is reached with the current configuration.
          The following statement skips the TooManyRequestsException error thrown by the AWS SES client.

          For more details about the errors and best practices to handle them, refer to:
          - AWS SES client: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-ses/Class/SES/
          - AWS SDK Error Handling: https://aws.amazon.com/blogs/developer/service-error-handling-modular-aws-sdk-js/  
        */
        if (err instanceof TooManyRequestsException) {
          errorHandlingOptions?.logger.warn(
            `AWS SES error with name ${err.name} was thrown, skipTooManyRequestsError is true so it will not be considered fatal, but the email is NOT sent; Error details: ${err.message}`
          );
          return;
        }
        throw err;
      }
    },
  };
}
