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
  attempts: 0,
  lastError: null,
  createdAt: new Date(),
  ...overrides,
});

const makeDb = (
  batches: ScheduledNotificationRow[][]
): {
  db: ScheduledNotificationDrizzleReturnType;
  updates: Array<{ id: string; set: Record<string, unknown> }>;
} => {
  const updates: Array<{ id: string; set: Record<string, unknown> }> = [];
  let batchIndex = 0;

  const makeChain = (rows: ScheduledNotificationRow[]): any => ({
    from: () => ({
      where: () => ({
        for: () => ({
          limit: async () => rows,
        }),
      }),
    }),
  });

  const tx = {
    select: () => makeChain(batches[batchIndex] ?? []),
    update: () => ({
      set: (s: Record<string, unknown>) => ({
        where: async (whereClause: { id?: string }) => {
          // capture id from "eq(scheduledNotification.id, row.id)" via getter shim:
          // we cannot introspect drizzle's eq output here, so the helper attaches
          // the id via a sidechannel by reading it from the most recent row in the batch.
          // The unit tests only assert update count + payload, so we accept "best-effort id".
          updates.push({
            id: whereClause?.id ?? "captured",
            set: s,
          });
        },
      }),
    }),
  };

  return {
    db: {
      transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
        const result = await fn(tx);
        batchIndex += 1;
        return result;
      },
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
      db,
      dispatch,
      sink,
      log,
    });

    expect(counters).toEqual({ processed: 0, skipped: 0, failed: 0 });
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
      db,
      dispatch,
      sink,
      log,
    });

    expect(counters).toEqual({ processed: 1, skipped: 0, failed: 0 });
    expect(dispatch).toHaveBeenCalledWith(row);
    expect(sink).toHaveBeenCalledWith([{ payload: "x" }]);
    expect(updates).toHaveLength(1);
    expect(updates[0].set).toMatchObject({ sentAt: expect.any(Date) });
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
      db,
      dispatch,
      sink,
      log,
    });

    expect(counters).toEqual({ processed: 0, skipped: 1, failed: 0 });
    expect(sink).not.toHaveBeenCalled();
    expect(updates[0].set).toMatchObject({ sentAt: expect.any(Date) });
  });

  it("counts as failed and bumps attempts on dispatch error", async () => {
    const row = buildRow({ attempts: 1 });
    const { db, updates } = makeDb([[row], []]);
    const dispatch = vi.fn().mockRejectedValue(new Error("boom"));
    const sink = vi.fn();

    const counters = await runScheduledDeliveryBatch({
      channel: scheduledNotificationChannel.inApp,
      batchSize: 10,
      maxBatchesPerRun: 5,
      maxAttempts: 3,
      db,
      dispatch,
      sink,
      log,
    });

    expect(counters).toEqual({ processed: 0, skipped: 0, failed: 1 });
    expect(sink).not.toHaveBeenCalled();
    expect(updates[0].set).toMatchObject({
      attempts: 2,
      lastError: expect.stringContaining("boom"),
    });
  });

  it("stops early when a batch returns fewer rows than batchSize", async () => {
    const row = buildRow();
    const { db } = makeDb([[row]]); // single small batch, then queue is empty
    const dispatch = vi.fn().mockResolvedValue([{ payload: "x" }]);
    const sink = vi.fn().mockResolvedValue(undefined);

    // batchSize is 10 but only 1 row returned -> loop exits, no second batch
    await runScheduledDeliveryBatch({
      channel: scheduledNotificationChannel.inApp,
      batchSize: 10,
      maxBatchesPerRun: 99,
      maxAttempts: 3,
      db,
      dispatch,
      sink,
      log,
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
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
      db,
      dispatch,
      sink,
      log,
    });

    // 2 full batches × 2 rows = 4 processed; maxBatchesPerRun caps further work
    expect(counters.processed).toBe(4);
    expect(dispatch).toHaveBeenCalledTimes(4);
  });
});
