import { EmailManagerConfig } from "pagopa-interop-commons";
import { z } from "zod";

export const AgreementEmailSenderConfig = z
  .object({
    PEC_SENDER_MAIL: z.string().email(),
    PEC_SENDER_LABEL: z.string(),
    SENDER_MAIL: z.string().email(),
    SENDER_LABEL: z.string(),
  })
  .transform((c) => ({
    pecSenderMail: c.PEC_SENDER_MAIL,
    pecSenderLabel: c.PEC_SENDER_LABEL,
    senderMail: c.SENDER_MAIL,
    senderLabel: c.SENDER_LABEL,
  }));

export type AgreementEmailSenderConfig = z.infer<
  typeof AgreementEmailSenderConfig
>;

export const agreementEmailSenderConfig: () => AgreementEmailSenderConfig =
  () => AgreementEmailSenderConfig.parse(process.env);

export const emailManagerConfig: () => EmailManagerConfig = () =>
  EmailManagerConfig.parse(process.env);

export const pecEmailManagerConfig: () => EmailManagerConfig = () =>
  z
    .object({
      PEC_SMTP_ADDRESS: z.string(),
      PEC_SMTP_PORT: z.coerce.number(),
      PEC_SMTP_SECURE: z
        .enum(["true", "false"])
        .transform((value) => value === "true"),
      PEC_SMTP_USERNAME: z.string(),
      PEC_SMTP_PASSWORD: z.string(),
    })
    .transform((c) => ({
      smtpAddress: c.PEC_SMTP_ADDRESS,
      smtpPort: c.PEC_SMTP_PORT,
      smtpSecure: c.PEC_SMTP_SECURE,
      smtpUsername: c.PEC_SMTP_USERNAME,
      smtpPassword: c.PEC_SMTP_PASSWORD,
    }))
    .parse(process.env);
