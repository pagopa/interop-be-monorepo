import nodemailer from "nodemailer";
import { EmailManagerConfig } from "../config/emailManagerConfig.js";

export type EmailManager = {
  send: (
    from: string,
    to: string[],
    subject: string,
    body: string
  ) => Promise<void>;
};

export function initEmailManager(config: EmailManagerConfig): EmailManager {
  return {
    send: async (
      from: string,
      to: string[],
      subject: string,
      body: string
    ): Promise<void> => {
      const transporter = nodemailer.createTransport({
        host: config.smtpAddress,
        port: config.smtpPort,
        secure: config.smtpPort === 465, // Use `true` for port 465, `false` for all other ports
      });
      await transporter.sendMail({
        from,
        to,
        subject,
        html: body,
      });
    },
  };
}
