import {
  InAppNotificationDBConfig,
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
  })
  .transform((c) => ({
    deliveryBatchSize: c.DELIVERY_BATCH_SIZE,
    maxAttempts: c.MAX_ATTEMPTS,
    maxBatchesPerRun: c.MAX_BATCHES_PER_RUN,
  }));

const ScheduledInAppNotificationDispatcherConfig = LoggerConfig.and(
  ReadModelSQLDbConfig
)
  .and(InAppNotificationDBConfig)
  .and(ScheduledNotificationDBConfig)
  .and(ScheduledNotificationStalenessConfig)
  .and(ScheduledDispatcherTuningConfig)
  .and(NotificationTypeBlocklistConfig);

type ScheduledInAppNotificationDispatcherConfig = z.infer<
  typeof ScheduledInAppNotificationDispatcherConfig
>;

export const config: ScheduledInAppNotificationDispatcherConfig =
  ScheduledInAppNotificationDispatcherConfig.parse(process.env);
