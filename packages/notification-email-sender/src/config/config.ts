import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  ReadModelDbConfig,
  AWSSesConfig,
  PurposeTopicConfig,
  CatalogTopicConfig,
  FeatureFlagSQLConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const SESEmailSenderConfig = z
  .object({
    INTEROP_FE_BASE_URL: z.string(),
    SENDER_MAIL: z.string().email(),
    SENDER_LABEL: z.string(),
  })
  .transform((c) => ({
    interopFeBaseUrl: c.INTEROP_FE_BASE_URL,
    senderMail: c.SENDER_MAIL,
    senderLabel: c.SENDER_LABEL,
  }));
export type SESEmailSenderConfig = z.infer<typeof SESEmailSenderConfig>;

export const NotificationEmailSenderRedisConfig = z
  .object({
    REDIS_NOTIFICATION_EMAIL_SENDER_HOST: z.string(),
    REDIS_NOTIFICATION_EMAIL_SENDER_PORT: z.coerce.number().min(1001),
  })
  .transform((c) => ({
    redisNotificationEmailSenderHost: c.REDIS_NOTIFICATION_EMAIL_SENDER_HOST,
    redisNotificationEmailSenderPort: c.REDIS_NOTIFICATION_EMAIL_SENDER_PORT,
  }));

export const NotificationEmailSenderConfig = KafkaConsumerConfig.and(
  ReadModelDbConfig
)
  .and(AgreementTopicConfig)
  .and(AWSSesConfig)
  .and(SESEmailSenderConfig)
  .and(PurposeTopicConfig)
  .and(CatalogTopicConfig)
  .and(FeatureFlagSQLConfig)
  .and(ReadModelSQLDbConfig.optional())
  .and(NotificationEmailSenderRedisConfig);

export type NotificationEmailSenderConfig = z.infer<
  typeof NotificationEmailSenderConfig
>;

export const config: NotificationEmailSenderConfig =
  NotificationEmailSenderConfig.parse(process.env);
