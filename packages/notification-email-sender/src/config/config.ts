import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  AWSSesConfig,
  PurposeTopicConfig,
  CatalogTopicConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const SESEmailSenderConfig = z
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
type SESEmailSenderConfig = z.infer<typeof SESEmailSenderConfig>;

const NotificationEmailSenderRedisConfig = z
  .object({
    REDIS_NOTIFICATION_EMAIL_SENDER_HOST: z.string(),
    REDIS_NOTIFICATION_EMAIL_SENDER_PORT: z.coerce.number().min(1001),
    REDIS_NOTIFICATION_EMAIL_SENDER_TTL_SECONDS: z.coerce.number(),
  })
  .transform((c) => ({
    redisNotificationEmailSenderHost: c.REDIS_NOTIFICATION_EMAIL_SENDER_HOST,
    redisNotificationEmailSenderPort: c.REDIS_NOTIFICATION_EMAIL_SENDER_PORT,
    redisNotificationEmailSenderTtlSeconds:
      c.REDIS_NOTIFICATION_EMAIL_SENDER_TTL_SECONDS,
  }));

const NotificationEmailSenderConfig = KafkaConsumerConfig.and(
  ReadModelSQLDbConfig
)
  .and(AgreementTopicConfig)
  .and(AWSSesConfig)
  .and(SESEmailSenderConfig)
  .and(PurposeTopicConfig)
  .and(CatalogTopicConfig)
  .and(NotificationEmailSenderRedisConfig);

type NotificationEmailSenderConfig = z.infer<
  typeof NotificationEmailSenderConfig
>;

export const config: NotificationEmailSenderConfig =
  NotificationEmailSenderConfig.parse(process.env);
