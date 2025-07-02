import {
  AWSSesConfig,
  KafkaConsumerConfig,
  EmailSenderTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const SESEmailSenderConfig = z
  .object({
    SENDER_MAIL: z.string().email(),
    SENDER_LABEL: z.string(),
    RETRY_DELAY_IN_MILLIS: z.coerce.number().int().gte(0),
    MAX_ATTEMPTS: z.coerce.number().int().gte(0),
  })
  .transform((c) => ({
    senderMail: c.SENDER_MAIL,
    senderLabel: c.SENDER_LABEL,
    retryDelayInMillis: c.RETRY_DELAY_IN_MILLIS,
    maxAttempts: c.MAX_ATTEMPTS,
  }));
export type SESEmailSenderConfig = z.infer<typeof SESEmailSenderConfig>;

export const EmailSenderConfig = KafkaConsumerConfig.and(
  SESEmailSenderConfig
)
  .and(AWSSesConfig)
  .and(EmailSenderTopicConfig);

export type EmailSenderConfig = z.infer<
  typeof EmailSenderConfig
>;

export const config: EmailSenderConfig =
  EmailSenderConfig.parse(process.env);
