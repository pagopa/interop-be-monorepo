import { and, eq, isNull, lt, lte } from "drizzle-orm";
import { scheduledNotification } from "pagopa-interop-scheduled-notification-db-models";
import {
  RunScheduledDeliveryBatchCounters,
  RunScheduledDeliveryBatchParams,
} from "./types.js";

/**
 * Drain ready rows from `scheduled_notification` for the given channel.
 *
 * Each row is locked with `FOR UPDATE SKIP LOCKED` so concurrent dispatcher
 * runs see disjoint batches. For every locked row we call `dispatch` (which
 * resolves recipients and builds channel-specific payloads), then push the
 * payloads through `sink`. On success we mark `sent_at`; on failure we bump
 * `attempts` and store `last_error`. Rows above `maxAttempts` are excluded
 * from future batches (logical dead-letter).
 *
 * The loop runs up to `maxBatchesPerRun` batches and exits early when a
 * batch returns fewer rows than `batchSize` (no more work).
 */
export const runScheduledDeliveryBatch = async <TPayload>({
  channel,
  batchSize,
  maxBatchesPerRun,
  maxAttempts,
  db,
  dispatch,
  sink,
  log,
}: RunScheduledDeliveryBatchParams<TPayload>): Promise<RunScheduledDeliveryBatchCounters> => {
  const counters: RunScheduledDeliveryBatchCounters = {
    processed: 0,
    skipped: 0,
    failed: 0,
  };

  for (let i = 0; i < maxBatchesPerRun; i++) {
    const batchResult = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(scheduledNotification)
        .where(
          and(
            eq(scheduledNotification.channel, channel),
            isNull(scheduledNotification.sentAt),
            lte(scheduledNotification.sendAt, new Date()),
            lt(scheduledNotification.attempts, maxAttempts)
          )
        )
        .for("update", { skipLocked: true })
        .limit(batchSize);

      if (rows.length === 0) {
        return { done: true } as const;
      }

      for (const row of rows) {
        try {
          const payloads = await dispatch(row);
          if (payloads.length === 0) {
            counters.skipped += 1;
          } else {
            await sink(payloads);
            counters.processed += 1;
          }
          await tx
            .update(scheduledNotification)
            .set({ sentAt: new Date() })
            .where(eq(scheduledNotification.id, row.id));
        } catch (err) {
          counters.failed += 1;
          await tx
            .update(scheduledNotification)
            .set({
              attempts: row.attempts + 1,
              lastError: String(err),
            })
            .where(eq(scheduledNotification.id, row.id));
          log.error(`Delivery failed for row ${row.id}: ${String(err)}`);
        }
      }

      return { done: rows.length < batchSize } as const;
    });

    if (batchResult.done) {
      break;
    }
  }

  return counters;
};
