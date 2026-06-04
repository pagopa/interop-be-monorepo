import { and, eq, isNull, lt, lte } from "drizzle-orm";
import { scheduledNotification } from "pagopa-interop-scheduled-notification-db-models";
import { isStale } from "./staleness.js";
import {
  RunScheduledDeliveryBatchCounters,
  RunScheduledDeliveryBatchParams,
} from "./types.js";

/**
 * Drain ready rows from `scheduled_notification` for the given channel.
 *
 * Concurrency: each candidate row is claimed atomically via a conditional
 * UPDATE that bumps `attempts` only if `sent_at` is still NULL and the
 * previously-observed `attempts` value hasn't changed. Concurrent workers
 * that try to claim the same row will see 0 rows returned and move on.
 *
 * Side-effect ordering: `dispatch` and `sink` run OUTSIDE any DB transaction.
 * The post-sink `sent_at` write is a single short statement; if it fails,
 * the next batch will re-attempt the delivery — accepted trade-off, since
 * the alternative (sink inside a long-running tx) would silently re-deliver
 * every row in the batch on any commit failure.
 *
 * Rows above `maxAttempts` are excluded from future batches (logical
 * dead-letter). The loop runs up to `maxBatchesPerRun` batches and exits
 * early when fewer rows than `batchSize` are claimed.
 */
export const runScheduledDeliveryBatch = async <TPayload>({
  channel,
  batchSize,
  maxBatchesPerRun,
  maxAttempts,
  stalenessThresholdHours,
  db,
  dispatch,
  sink,
  log,
}: RunScheduledDeliveryBatchParams<TPayload>): Promise<RunScheduledDeliveryBatchCounters> => {
  const counters: RunScheduledDeliveryBatchCounters = {
    processed: 0,
    skipped: 0,
    skippedStale: 0,
    failed: 0,
  };

  for (let i = 0; i < maxBatchesPerRun; i++) {
    const candidates = await db
      .select()
      .from(scheduledNotification)
      .where(
        and(
          eq(scheduledNotification.channel, channel),
          isNull(scheduledNotification.sentAt),
          isNull(scheduledNotification.skippedAt),
          lte(scheduledNotification.sendAt, new Date()),
          lt(scheduledNotification.attempts, maxAttempts)
        )
      )
      .limit(batchSize);

    if (candidates.length === 0) {
      break;
    }

    let claimedCount = 0;

    for (const candidate of candidates) {
      const claimed = await db
        .update(scheduledNotification)
        .set({ attempts: candidate.attempts + 1 })
        .where(
          and(
            eq(scheduledNotification.id, candidate.id),
            isNull(scheduledNotification.sentAt),
            isNull(scheduledNotification.skippedAt),
            eq(scheduledNotification.attempts, candidate.attempts)
          )
        )
        .returning();

      if (claimed.length === 0) {
        continue;
      }
      claimedCount += 1;
      const row = claimed[0];

      if (isStale(row.sendAt, stalenessThresholdHours)) {
        await db
          .update(scheduledNotification)
          .set({ skippedAt: new Date() })
          .where(eq(scheduledNotification.id, row.id));
        counters.skippedStale += 1;
        log.info(
          `Skipping stale row ${row.id} (sendAt=${row.sendAt.toISOString()}, threshold=${stalenessThresholdHours}h)`
        );
        continue;
      }

      try {
        const payloads = await dispatch(row);
        if (payloads.length === 0) {
          counters.skipped += 1;
        } else {
          await sink(payloads);
          counters.processed += 1;
        }
        await db
          .update(scheduledNotification)
          .set({ sentAt: new Date() })
          .where(eq(scheduledNotification.id, row.id));
      } catch (err) {
        counters.failed += 1;
        await db
          .update(scheduledNotification)
          .set({ lastError: String(err) })
          .where(eq(scheduledNotification.id, row.id));
        log.error(`Delivery failed for row ${row.id}: ${String(err)}`);
      }
    }

    if (claimedCount < batchSize) {
      break;
    }
  }

  return counters;
};
