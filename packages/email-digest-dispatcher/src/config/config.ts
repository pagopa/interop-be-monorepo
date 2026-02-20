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

// Config for digest frequency
export const DigestFrequencyConfig = z
  .object({
    DIGEST_FREQUENCY_HOURS: z.coerce.number().min(1).default(168),
  })
  .transform((c) => ({
    digestFrequencyHours: c.DIGEST_FREQUENCY_HOURS,
  }));

export type DigestFrequencyConfig = z.infer<typeof DigestFrequencyConfig>;

// Config for BFF URL
export const BffUrlConfig = z
  .object({
    BFF_URL: z.string().url(),
  })
  .transform((c) => ({
    bffUrl: c.BFF_URL,
  }));

export type BffUrlConfig = z.infer<typeof BffUrlConfig>;

// Config for priority producer IDs (comma-separated list of tenant UUIDs)
export const PriorityProducerIdsConfig = z
  .object({
    PRIORITY_PRODUCER_IDS: z.string().optional(),
  })
  .transform((c) => ({
    priorityProducerIds:
      c.PRIORITY_PRODUCER_IDS?.split(",").map((id) => id.trim()) ?? [],
  }));

export type PriorityProducerIdsConfig = z.infer<
  typeof PriorityProducerIdsConfig
>;

export const EmailNotificationDigestConfig = LoggerConfig.and(
  ReadModelSQLDbConfig
)
  .and(KafkaProducerConfig)
  .and(EmailDispatchTopicConfig)
  .and(DigestTrackingDbConfig)
  .and(DigestFrequencyConfig)
  .and(BffUrlConfig)
  .and(PriorityProducerIdsConfig);

export type EmailNotificationDigestConfig = z.infer<
  typeof EmailNotificationDigestConfig
>;

export const config: EmailNotificationDigestConfig =
  EmailNotificationDigestConfig.parse(process.env);
