import {
  AgreementTopicConfig,
  PecEmailManagerConfig,
  KafkaConsumerConfig,
  ReadModelDbConfig,
  AWSSesConfig,
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

export const AgreementEmailSenderConfig = KafkaConsumerConfig.and(
  ReadModelDbConfig
)
  .and(AgreementTopicConfig)
  .and(PecEmailManagerConfig)
  .and(AWSSesConfig)
  .and(EmailSenderConfig);

export type AgreementEmailSenderConfig = z.infer<
  typeof AgreementEmailSenderConfig
>;

export const config: AgreementEmailSenderConfig =
  AgreementEmailSenderConfig.parse(process.env);
