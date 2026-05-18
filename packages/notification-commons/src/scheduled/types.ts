import { Logger } from "pagopa-interop-commons";
import {
  ScheduledNotificationChannel,
  ScheduledNotificationDrizzleReturnType,
  ScheduledNotificationRow,
} from "pagopa-interop-scheduled-notification-db-models";

export type DispatchFn<TPayload> = (
  row: ScheduledNotificationRow
) => Promise<TPayload[]>;

export type SinkFn<TPayload> = (payloads: TPayload[]) => Promise<void>;

export type RunScheduledDeliveryBatchParams<TPayload> = {
  channel: ScheduledNotificationChannel;
  batchSize: number;
  maxBatchesPerRun: number;
  maxAttempts: number;
  db: ScheduledNotificationDrizzleReturnType;
  dispatch: DispatchFn<TPayload>;
  sink: SinkFn<TPayload>;
  log: Logger;
};

export type RunScheduledDeliveryBatchCounters = {
  processed: number;
  skipped: number;
  failed: number;
};
