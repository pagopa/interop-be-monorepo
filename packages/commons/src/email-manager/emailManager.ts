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
} from "@aws-sdk/client-sesv2";
import { Address, Attachment } from "nodemailer/lib/mailer/index.js";
import { PecEmailManagerConfig } from "../index.js";
import { AWSSesConfig } from "../config/awsSesConfig.js";

export type EmailManagerKind = "PEC" | "SES";

export type EmailManager = {
  kind: EmailManagerKind;
  send: (
    from: string | { name: string; address: string },
    to: string[],
    subject: string,
    body: string
  ) => Promise<void>;
  sendWithAttachments: (
    from: string | { name: string; address: string },
    to: string[],
    subject: string,
    body: string,
    attachments: Attachment[]
  ) => Promise<void>;
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
    send: async (
      from: string | Address,
      to: string[],
      subject: string,
      body: string
    ): Promise<void> => {
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
      await transporter.sendMail({
        from,
        to,
        subject,
        html: body,
      });
    },
    sendWithAttachments: async (
      from: string | Address,
      to: string[],
      subject: string,
      body: string,
      attachments: Attachment[]
    ): Promise<void> => {
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
      await transporter.sendMail({
        from,
        to,
        subject,
        html: body,
        attachments,
      });
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
    send: async (
      from: string | Address,
      to: string[],
      subject: string,
      body: string
    ): Promise<void> => {
      const params: SendEmailCommandInput = {
        Destination: {
          ToAddresses: to,
        },
        Content: {
          Simple: {
            Subject: {
              Data: subject,
            },
            Body: {
              Html: {
                Data: body,
              },
            },
          },
        },
        FromEmailAddress:
          typeof from === "string" ? from : `${from.name} <${from.address}>`,
      };

      const command = new SendEmailCommand(params);
      await client.send(command);
    },
    sendWithAttachments: async (
      from: string | Address,
      to: string[],
      subject: string,
      body: string,
      attachments: Attachment[]
    ): Promise<void> => {
      const mailOptions = {
        from,
        subject,
        html: body,
        to,
        attachments,
      };
      const rawMailData = await new MailComposer(mailOptions).compile().build();

      const input = {
        Content: {
          Raw: { Data: rawMailData },
        },
      };
      const cmd = new SendEmailCommand(input);

      await client.send(cmd);
    },
  };
}
