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
  })
  .transform((c) => ({
    interopFeBaseUrl: c.INTEROP_FE_BASE_URL,
    pecSenderMail: c.PEC_SENDER_MAIL,
    pecSenderLabel: c.PEC_SENDER_LABEL,
  }));
export type EmailSenderConfig = z.infer<typeof EmailSenderConfig>;

export const CertifiedEmailSenderConfig = KafkaConsumerConfig.and(
  ReadModelDbConfig
)
  .and(AgreementTopicConfig)
  .and(PecEmailManagerConfig)
  .and(AWSSesConfig)
  .and(EmailSenderConfig);

export type CertifiedEmailSenderConfig = z.infer<
  typeof CertifiedEmailSenderConfig
>;

export const config: CertifiedEmailSenderConfig =
  CertifiedEmailSenderConfig.parse(process.env);
