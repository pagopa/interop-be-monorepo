import { EmailManagerConfig } from "pagopa-interop-commons";
import { z } from "zod";

export const AgreementEmailSenderConfig = z
  .object({
    AGREEMENT_EMAIL_SENDER: z.string().email(),
    AWS_SES_AGREEMENT_EMAIL_SENDER: z.string().email(),
  })
  .transform((c) => ({
    agreementEmailSender: c.AGREEMENT_EMAIL_SENDER,
    awsSesAgreementEmailSender: c.AWS_SES_AGREEMENT_EMAIL_SENDER,
  }));

export type AgreementEmailSenderConfig = z.infer<
  typeof AgreementEmailSenderConfig
>;

export const agreementEmailSenderConfig: () => AgreementEmailSenderConfig =
  () => AgreementEmailSenderConfig.parse(process.env);

export const pecEmailManagerConfig: () => EmailManagerConfig = () =>
  EmailManagerConfig.parse(process.env);

export const awsSesEmailManagerConfig: () => EmailManagerConfig = () =>
  z
    .object({
      AWS_SES_SMTP_ADDRESS: z.string(),
      AWS_SES_SMTP_PORT: z.coerce.number(),
      AWS_SES_SMTP_SECURE: z
        .enum(["true", "false"])
        .transform((value) => value === "true"),
      AWS_SES_SMTP_USERNAME: z.string(),
      AWS_SES_SMTP_PASSWORD: z.string(),
    })
    .transform((c) => ({
      smtpAddress: c.AWS_SES_SMTP_ADDRESS,
      smtpPort: c.AWS_SES_SMTP_PORT,
      smtpSecure: c.AWS_SES_SMTP_SECURE,
      smtpUsername: c.AWS_SES_SMTP_USERNAME,
      smtpPassword: c.AWS_SES_SMTP_PASSWORD,
    }))
    .parse(process.env);
