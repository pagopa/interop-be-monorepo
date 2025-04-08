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
import { PecEmailManagerConfig } from "../index.js";
import { AWSSesConfig } from "../config/awsSesConfig.js";

/* 
  AllowedSESErrors is used to limit other packages to filter only specific error from SESv2Client, 
  and also avoid dependency on AWS SDK in other packages.
*/
export { TooManyRequestsException as AllowedSESErrors };

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

export function initSesMailManager(awsConfig: AWSSesConfig): EmailManagerSES {
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

      await client.send(new SendEmailCommand(input));
    },
  };
}
