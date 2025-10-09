import {
  AWSSesConfig,
  KafkaConsumerConfig,
  EmailSenderTopicConfig,
  SelfCareClientConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const SESEmailSenderConfig = z
  .object({
    SENDER_MAIL: z.string().email(),
    SENDER_LABEL: z.string(),
    RETRY_DELAY_IN_MILLIS: z.coerce.number().int().gte(0),
    SUCCESS_DELAY_IN_MILLIS: z.coerce.number().int().gte(0),
    SELFCARE_API_MAX_RETRIES: z.coerce.number().int().gte(0),
    SELFCARE_API_RETRY_DELAY_IN_MILLIS: z.coerce.number().int().gte(0),
  })
  .transform((c) => ({
    senderMail: c.SENDER_MAIL,
    senderLabel: c.SENDER_LABEL,
    retryDelayInMillis: c.RETRY_DELAY_IN_MILLIS,
    successDelayInMillis: c.SUCCESS_DELAY_IN_MILLIS,
    selfcareApiMaxRetries: c.SELFCARE_API_MAX_RETRIES,
    selfcareApiRetryDelayInMillis: c.SELFCARE_API_RETRY_DELAY_IN_MILLIS,
  }));
export type SESEmailSenderConfig = z.infer<typeof SESEmailSenderConfig>;

export const EmailSenderConfig = KafkaConsumerConfig.and(SESEmailSenderConfig)
  .and(AWSSesConfig)
  .and(EmailSenderTopicConfig)
  .and(SelfCareClientConfig)
  .and(ReadModelSQLDbConfig);

export type EmailSenderConfig = z.infer<typeof EmailSenderConfig>;

export const config: EmailSenderConfig = EmailSenderConfig.parse(process.env);
