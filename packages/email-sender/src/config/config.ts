import { AWSSesConfig, KafkaConsumerConfig } from "pagopa-interop-commons";
import { z } from "zod";

export const SESEmailSenderConfig = z
  .object({
    INTEROP_FE_BASE_URL: z.string(),
    SENDER_MAIL: z.string().email(),
    SENDER_LABEL: z.string(),
    RETRY_DELAY: z.coerce.number().int().gte(0),
    MAX_ATTEMPTS: z.coerce.number().int().gte(0),
  })
  .transform((c) => ({
    interopFeBaseUrl: c.INTEROP_FE_BASE_URL,
    senderMail: c.SENDER_MAIL,
    senderLabel: c.SENDER_LABEL,
    retryDelay: c.RETRY_DELAY,
    maxAttempts: c.MAX_ATTEMPTS,
  }));
export type SESEmailSenderConfig = z.infer<typeof SESEmailSenderConfig>;

export const EmailTopicConfig = z
  .object({
    EMAIL_TOPIC: z.string(),
  })
  .transform((c) => ({
    emailTopic: c.EMAIL_TOPIC,
  }));
export type EmailTopicConfig = z.infer<typeof EmailTopicConfig>;

export const EmailSenderConsumerConfig = KafkaConsumerConfig.and(
  SESEmailSenderConfig
)
  .and(AWSSesConfig)
  .and(EmailTopicConfig);

export type EmailSenderConsumerConfig = z.infer<
  typeof EmailSenderConsumerConfig
>;

export const config: EmailSenderConsumerConfig =
  EmailSenderConsumerConfig.parse(process.env);
