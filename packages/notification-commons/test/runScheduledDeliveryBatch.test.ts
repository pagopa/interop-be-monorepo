/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger } from "pagopa-interop-commons";
import {
  ScheduledNotificationRow,
  scheduledNotificationChannel,
  schedulableEventType,
  ScheduledNotificationDrizzleReturnType,
} from "pagopa-interop-scheduled-notification-db-models";
import { runScheduledDeliveryBatch } from "../src/scheduled/runScheduledDeliveryBatch.js";

const log = logger({
  serviceName: "runScheduledDeliveryBatch-test",
  correlationId: "00000000-0000-0000-0000-000000000000" as any,
});

const buildRow = (
  overrides: Partial<ScheduledNotificationRow> = {}
): ScheduledNotificationRow => ({
  id: "00000000-0000-0000-0000-000000000001",
  channel: scheduledNotificationChannel.inApp,
  eventType: schedulableEventType.eserviceDescriptorArchivingScheduled,
  entityId: "eservice-1/descriptor-1",
  correlationId: "00000000-0000-0000-0000-000000000002",
  sendAt: new Date(),
  sentAt: null,
  skippedAt: null,
  attempts: 0,
  lastError: null,
  createdAt: new Date(),
  ...overrides,
});

type Update = { set: Record<string, unknown>; returning: boolean };

/**
 * Mocks the drizzle chain used by runScheduledDeliveryBatch (no transactions):
 *  - `db.select().from(...).where(...).limit(N)` returns the next batch
 *  - `db.update(...).set(...).where(...).returning()` is the per-row claim
 *  - `db.update(...).set(...).where(...)` is the post-dispatch sentAt/lastError write
 *
 * `claimedRows` controls which candidates get successfully claimed; by default
 * every candidate is claimed.
 */
const makeDb = (
  batches: ScheduledNotificationRow[][],
  options: { claimedRows?: ScheduledNotificationRow[] } = {}
): {
  db: ScheduledNotificationDrizzleReturnType;
  updates: Update[];
} => {
  const updates: Update[] = [];
  let batchIndex = 0;
  const candidatesFlat = batches.flat();
  const claimedRows = options.claimedRows ?? candidatesFlat;
  let claimIndex = 0;

  const selectChain = (rows: ScheduledNotificationRow[]): any => ({
    from: () => ({
      where: () => ({
        limit: async () => rows,
      }),
    }),
  });

  const updateChain = (): any => ({
    set: (s: Record<string, unknown>) => ({
      where: (_w: unknown) => {
        const op = {
          returning: async () => {
            updates.push({ set: s, returning: true });
            const next = claimedRows[claimIndex];
            claimIndex += 1;
            return next ? [next] : [];
          },
          then: (resolve: (v: unknown) => unknown) => {
            updates.push({ set: s, returning: false });
            return Promise.resolve().then(resolve);
          },
        };
        return op;
      },
    }),
  });

  return {
    db: {
      select: () => {
        const rows = batches[batchIndex] ?? [];
        batchIndex += 1;
        return selectChain(rows);
      },
      update: () => updateChain(),
    } as unknown as ScheduledNotificationDrizzleReturnType,
    updates,
  };
};

describe("runScheduledDeliveryBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero counters when no rows are ready", async () => {
    const { db } = makeDb([[]]);
    const dispatch = vi.fn();
    const sink = vi.fn();

    const counters = await runScheduledDeliveryBatch({
      channel: scheduledNotificationChannel.inApp,
      batchSize: 10,
      maxBatchesPerRun: 5,
      maxAttempts: 3,
      stalenessThresholdHours: 24,
      db,
      dispatch,
      sink,
      log,
    });

    expect(counters).toEqual({
      processed: 0,
      skipped: 0,
      skippedStale: 0,
      failed: 0,
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(sink).not.toHaveBeenCalled();
  });

  it("processes rows and sends through the sink", async () => {
    const row = buildRow();
    const { db, updates } = makeDb([[row], []]);
    const dispatch = vi.fn().mockResolvedValue([{ payload: "x" }]);
    const sink = vi.fn().mockResolvedValue(undefined);

    const counters = await runScheduledDeliveryBatch({
      channel: scheduledNotificationChannel.inApp,
      batchSize: 10,
      maxBatchesPerRun: 5,
      maxAttempts: 3,
      stalenessThresholdHours: 24,
      db,
      dispatch,
      sink,
      log,
    });

    expect(counters).toEqual({
      processed: 1,
      skipped: 0,
      skippedStale: 0,
      failed: 0,
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith([{ payload: "x" }]);
    // 1 claim update (returning) + 1 sentAt update
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({
      set: { attempts: 1 },
      returning: true,
    });
    expect(updates[1]).toMatchObject({
      set: { sentAt: expect.any(Date) },
      returning: false,
    });
  });

  it("counts as skipped when dispatch returns no payloads", async () => {
    const row = buildRow();
    const { db, updates } = makeDb([[row], []]);
    const dispatch = vi.fn().mockResolvedValue([]);
    const sink = vi.fn();

    const counters = await runScheduledDeliveryBatch({
      channel: scheduledNotificationChannel.inApp,
      batchSize: 10,
      maxBatchesPerRun: 5,
      maxAttempts: 3,
      stalenessThresholdHours: 24,
      db,
      dispatch,
      sink,
      log,
    });

    expect(counters).toEqual({
      processed: 0,
      skipped: 1,
      skippedStale: 0,
      failed: 0,
    });
    expect(sink).not.toHaveBeenCalled();
    // 1 claim + 1 sentAt update (skipped rows are still marked sent to avoid replay)
    expect(updates).toHaveLength(2);
    expect(updates[1]).toMatchObject({ set: { sentAt: expect.any(Date) } });
  });

  it("counts as failed and records lastError on dispatch error (attempts already bumped by claim)", async () => {
    const row = buildRow({ attempts: 1 });
    const { db, updates } = makeDb([[row], []], {
      claimedRows: [{ ...row, attempts: 2 }],
    });
    const dispatch = vi.fn().mockRejectedValue(new Error("boom"));
    const sink = vi.fn();

    const counters = await runScheduledDeliveryBatch({
      channel: scheduledNotificationChannel.inApp,
      batchSize: 10,
      maxBatchesPerRun: 5,
      maxAttempts: 3,
      stalenessThresholdHours: 24,
      db,
      dispatch,
      sink,
      log,
    });

    expect(counters).toEqual({
      processed: 0,
      skipped: 0,
      skippedStale: 0,
      failed: 1,
    });
    expect(sink).not.toHaveBeenCalled();
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({
      set: { attempts: 2 },
      returning: true,
    });
    expect(updates[1]).toMatchObject({
      set: { lastError: expect.stringContaining("boom") },
      returning: false,
    });
  });

  it("skips a row when the claim is lost to another worker", async () => {
    const row = buildRow();
    // candidates contains 1 row but claimedRows is empty -> claim returns 0
    const { db, updates } = makeDb([[row], []], { claimedRows: [] });
    const dispatch = vi.fn();
    const sink = vi.fn();

    const counters = await runScheduledDeliveryBatch({
      channel: scheduledNotificationChannel.inApp,
      batchSize: 10,
      maxBatchesPerRun: 5,
      maxAttempts: 3,
      stalenessThresholdHours: 24,
      db,
      dispatch,
      sink,
      log,
    });

    expect(counters).toEqual({
      processed: 0,
      skipped: 0,
      skippedStale: 0,
      failed: 0,
    });
    expect(dispatch).not.toHaveBeenCalled();
    // Only the (failed) claim update was issued
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ returning: true });
  });

  it("stops early when a batch returns fewer claimed rows than batchSize", async () => {
    const row = buildRow();
    const { db } = makeDb([[row]]);
    const dispatch = vi.fn().mockResolvedValue([{ payload: "x" }]);
    const sink = vi.fn().mockResolvedValue(undefined);

    await runScheduledDeliveryBatch({
      channel: scheduledNotificationChannel.inApp,
      batchSize: 10,
      maxBatchesPerRun: 99,
      maxAttempts: 3,
      stalenessThresholdHours: 24,
      db,
      dispatch,
      sink,
      log,
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("marks stale rows as skippedAt and counts skippedStale", async () => {
    const staleRow = buildRow({
      sendAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });
    const { db, updates } = makeDb([[staleRow], []]);
    const dispatch = vi.fn();
    const sink = vi.fn();

    const counters = await runScheduledDeliveryBatch({
      channel: scheduledNotificationChannel.inApp,
      batchSize: 10,
      maxBatchesPerRun: 5,
      maxAttempts: 3,
      stalenessThresholdHours: 24,
      db,
      dispatch,
      sink,
      log,
    });

    expect(counters).toEqual({
      processed: 0,
      skipped: 0,
      skippedStale: 1,
      failed: 0,
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(sink).not.toHaveBeenCalled();
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({
      set: { attempts: 1 },
      returning: true,
    });
    expect(updates[1]).toMatchObject({
      set: { skippedAt: expect.any(Date) },
      returning: false,
    });
  });

  it("processes non-stale rows alongside stale ones in the same batch", async () => {
    const staleRow = buildRow({
      id: "stale-row",
      sendAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });
    const freshRow = buildRow({ id: "fresh-row", sendAt: new Date() });
    const { db } = makeDb([[staleRow, freshRow], []]);
    const dispatch = vi.fn().mockResolvedValue([{ payload: "x" }]);
    const sink = vi.fn().mockResolvedValue(undefined);

    const counters = await runScheduledDeliveryBatch({
      channel: scheduledNotificationChannel.inApp,
      batchSize: 10,
      maxBatchesPerRun: 5,
      maxAttempts: 3,
      stalenessThresholdHours: 24,
      db,
      dispatch,
      sink,
      log,
    });

    expect(counters).toEqual({
      processed: 1,
      skipped: 0,
      skippedStale: 1,
      failed: 0,
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it("runs up to maxBatchesPerRun consecutive full batches", async () => {
    const rows1 = [buildRow({ id: "id-1" }), buildRow({ id: "id-2" })];
    const rows2 = [buildRow({ id: "id-3" }), buildRow({ id: "id-4" })];
    const { db } = makeDb([rows1, rows2, []]);
    const dispatch = vi.fn().mockResolvedValue([{ payload: "x" }]);
    const sink = vi.fn().mockResolvedValue(undefined);

    const counters = await runScheduledDeliveryBatch({
      channel: scheduledNotificationChannel.inApp,
      batchSize: 2,
      maxBatchesPerRun: 2,
      maxAttempts: 3,
      stalenessThresholdHours: 24,
      db,
      dispatch,
      sink,
      log,
    });

    expect(counters.processed).toBe(4);
    expect(dispatch).toHaveBeenCalledTimes(4);
  });
});
