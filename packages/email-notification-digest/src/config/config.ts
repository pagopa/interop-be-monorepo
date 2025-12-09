import {
  EmailDispatchTopicConfig,
  KafkaProducerConfig,
  LoggerConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

// Config for the digest tracking database (separate from readmodel)
export const DigestTrackingDbConfig = z
  .object({
    DIGEST_TRACKING_DB_HOST: z.string(),
    DIGEST_TRACKING_DB_NAME: z.string(),
    DIGEST_TRACKING_DB_USERNAME: z.string(),
    DIGEST_TRACKING_DB_PASSWORD: z.string(),
    DIGEST_TRACKING_DB_PORT: z.coerce.number().min(1001),
    DIGEST_TRACKING_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false"),
    DIGEST_TRACKING_DB_SCHEMA: z.string().default("digest_tracking"),
  })
  .transform((c) => ({
    digestTrackingDbHost: c.DIGEST_TRACKING_DB_HOST,
    digestTrackingDbName: c.DIGEST_TRACKING_DB_NAME,
    digestTrackingDbUsername: c.DIGEST_TRACKING_DB_USERNAME,
    digestTrackingDbPassword: c.DIGEST_TRACKING_DB_PASSWORD,
    digestTrackingDbPort: c.DIGEST_TRACKING_DB_PORT,
    digestTrackingDbUseSSL: c.DIGEST_TRACKING_DB_USE_SSL,
    digestTrackingDbSchema: c.DIGEST_TRACKING_DB_SCHEMA,
  }));

export type DigestTrackingDbConfig = z.infer<typeof DigestTrackingDbConfig>;

// Config for digest throttling
export const DigestThrottleConfig = z
  .object({
    DIGEST_THROTTLE_DAYS: z.coerce.number().min(1).default(7),
  })
  .transform((c) => ({
    digestThrottleDays: c.DIGEST_THROTTLE_DAYS,
  }));

export type DigestThrottleConfig = z.infer<typeof DigestThrottleConfig>;

export const EmailNotificationDigestConfig = LoggerConfig.and(
  ReadModelSQLDbConfig
)
  .and(KafkaProducerConfig)
  .and(EmailDispatchTopicConfig)
  .and(DigestTrackingDbConfig)
  .and(DigestThrottleConfig);

export type EmailNotificationDigestConfig = z.infer<
  typeof EmailNotificationDigestConfig
>;

export const config: EmailNotificationDigestConfig =
  EmailNotificationDigestConfig.parse(process.env);
