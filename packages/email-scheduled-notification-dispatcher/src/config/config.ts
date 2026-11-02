import {
  EmailDispatchTopicConfig,
  KafkaProducerConfig,
  LoggerConfig,
  NotificationTypeBlocklistConfig,
  ReadModelSQLDbConfig,
  ScheduledNotificationDBConfig,
  ScheduledNotificationStalenessConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const ScheduledDispatcherTuningConfig = z
  .object({
    DELIVERY_BATCH_SIZE: z.coerce.number().min(1).default(100),
    MAX_ATTEMPTS: z.coerce.number().min(1).default(5),
    MAX_BATCHES_PER_RUN: z.coerce.number().min(1).default(10),
    BFF_URL: z.string().url(),
  })
  .transform((c) => ({
    deliveryBatchSize: c.DELIVERY_BATCH_SIZE,
    maxAttempts: c.MAX_ATTEMPTS,
    maxBatchesPerRun: c.MAX_BATCHES_PER_RUN,
    bffUrl: c.BFF_URL,
  }));

const ScheduledEmailNotificationDispatcherConfig = LoggerConfig.and(
  KafkaProducerConfig
)
  .and(EmailDispatchTopicConfig)
  .and(ReadModelSQLDbConfig)
  .and(ScheduledNotificationDBConfig)
  .and(ScheduledNotificationStalenessConfig)
  .and(ScheduledDispatcherTuningConfig)
  .and(NotificationTypeBlocklistConfig);

type ScheduledEmailNotificationDispatcherConfig = z.infer<
  typeof ScheduledEmailNotificationDispatcherConfig
>;

export const config: ScheduledEmailNotificationDispatcherConfig =
  ScheduledEmailNotificationDispatcherConfig.parse(process.env);
