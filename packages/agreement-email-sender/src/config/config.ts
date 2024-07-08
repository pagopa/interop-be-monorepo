import {
  AgreementTopicConfig,
  EmailManagerConfig,
  KafkaConsumerConfig,
  ReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const EmailSenderConfig = z
  .object({
    INTEROP_FE_BASE_URL: z.string(),
    PEC_SENDER_MAIL: z.string().email(),
    PEC_SENDER_LABEL: z.string(),
    SENDER_MAIL: z.string().email(),
    SENDER_LABEL: z.string(),
  })
  .transform((c) => ({
    interopFeBaseUrl: c.INTEROP_FE_BASE_URL,
    pecSenderMail: c.PEC_SENDER_MAIL,
    pecSenderLabel: c.PEC_SENDER_LABEL,
    senderMail: c.SENDER_MAIL,
    senderLabel: c.SENDER_LABEL,
  }));
export type EmailSenderConfig = z.infer<typeof EmailSenderConfig>;

export const PecEmailManagerConfig = z
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
    pecSmtpAddress: c.PEC_SMTP_ADDRESS,
    pecSmtpPort: c.PEC_SMTP_PORT,
    pecSmtpSecure: c.PEC_SMTP_SECURE,
    pecSmtpUsername: c.PEC_SMTP_USERNAME,
    pecSmtpPassword: c.PEC_SMTP_PASSWORD,
  }));
export type PecEmailManagerConfig = z.infer<typeof PecEmailManagerConfig>;

export const AgreementEmailSenderConfig = KafkaConsumerConfig.and(
  ReadModelDbConfig
)
  .and(AgreementTopicConfig)
  .and(EmailManagerConfig)
  .and(PecEmailManagerConfig)
  .and(EmailSenderConfig);

export type AgreementEmailSenderConfig = z.infer<
  typeof AgreementEmailSenderConfig
>;

export const config: AgreementEmailSenderConfig =
  AgreementEmailSenderConfig.parse(process.env);
