import nodemailer from "nodemailer";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import { Address, Attachment } from "nodemailer/lib/mailer/index.js";
import { PecEmailManagerConfig } from "../index.js";
import { AWSSesConfig } from "../config/awsSesConfig.js";

export type EmailManager = {
  send: (
    from: string | { name: string; address: string },
    to: string[],
    subject: string,
    body: string,
    attachments?: Attachment[]
  ) => Promise<void>;
};

export function initPecEmailManager(
  config: PecEmailManagerConfig,
  rejectUnauthorized = true
): EmailManager {
  return {
    send: async (
      from: string | Address,
      to: string[],
      subject: string,
      body: string,
      attachments?: Attachment[]
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

export function initSesMailManager(awsConfig: AWSSesConfig): EmailManager {
  const client = new SESv2Client({
    region: awsConfig.awsRegion,
    endpoint: awsConfig.awsSesEndpoint,
  });

  return {
    send: async (
      from: string | Address,
      to: string[],
      subject: string,
      body: string,
      attachments?: Attachment[]
    ): Promise<void> => {
      const transporter = nodemailer.createTransport({
        SES: client,
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
