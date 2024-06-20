import {
  AgreementTopicConfig,
  EmailManagerConfig,
  KafkaConsumerConfig,
  ReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const SenderEmailConfig = z
  .object({
    SENDER_EMAIL_ADDRESS: z.string().email(),
  })
  .transform((c) => ({
    senderEmailAddress: c.SENDER_EMAIL_ADDRESS,
  }));
export type SenderEmailConfig = z.infer<typeof SenderEmailConfig>;

export const AgreementEmailSenderConfig = KafkaConsumerConfig.and(
  ReadModelDbConfig
)
  .and(AgreementTopicConfig)
  .and(EmailManagerConfig)
  .and(SenderEmailConfig);

export type AgreementEmailSenderConfig = z.infer<
  typeof AgreementEmailSenderConfig
>;

export const config: AgreementEmailSenderConfig =
  AgreementEmailSenderConfig.parse(process.env);
