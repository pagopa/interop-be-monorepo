import { eq, isNull } from "drizzle-orm";
import { genericLogger } from "pagopa-interop-commons";
import {
  CorrelationId,
  DescriptorId,
  EServiceId,
  generateId,
} from "pagopa-interop-models";
import {
  formatEServiceEntityId,
  formatEServiceIdDescriptorId,
  schedulableEventType,
  scheduledNotification,
  scheduledNotificationChannel,
} from "pagopa-interop-scheduled-notification-db-models";
import { describe, it, expect } from "vitest";

import { scheduledNotificationDB, schedulerService } from "./utils.js";

describe("scheduledNotificationScheduler integration", () => {
  it("inserts 6 rows (3 thresholds × 2 channels) for a descriptor-scope event and is replay-safe", async () => {
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const archivableOn = new Date("2027-01-01T00:00:00Z"); // far enough in the future

    const reminderDays = [7, 3, 1];
    const correlationId = generateId<CorrelationId>();
    const params = {
      eserviceId,
      descriptorId,
      archivableOn,
      eventType: schedulableEventType.eserviceDescriptorArchivingScheduled,
      reminderDays,
      sendAtHour: 9,
      tz: "Europe/Rome",
      correlationId,
    };

    const inserted1 = await schedulerService.scheduleReminders(
      params,
      genericLogger
    );
    expect(inserted1).toBe(reminderDays.length * 2);

    // Replay: same payload → no new rows (onConflictDoNothing)
    const inserted2 = await schedulerService.scheduleReminders(
      params,
      genericLogger
    );
    expect(inserted2).toBe(0);

    const stored = await scheduledNotificationDB
      .select()
      .from(scheduledNotification)
      .where(
        eq(
          scheduledNotification.entityId,
          formatEServiceIdDescriptorId(eserviceId, descriptorId)
        )
      );
    expect(stored).toHaveLength(reminderDays.length * 2);

    const channels = stored.map((r) => r.channel).sort();
    expect(channels).toEqual(
      [
        scheduledNotificationChannel.email,
        scheduledNotificationChannel.email,
        scheduledNotificationChannel.email,
        scheduledNotificationChannel.inApp,
        scheduledNotificationChannel.inApp,
        scheduledNotificationChannel.inApp,
      ].sort()
    );

    // correlation_id is preserved from the originating Kafka event payload
    expect(stored.every((r) => r.correlationId === correlationId)).toBe(true);
  });

  it("descriptor-scope DELETE only removes rows for the exact (eservice, descriptor) pair", async () => {
    const eserviceId = generateId<EServiceId>();
    const descriptorA = generateId<DescriptorId>();
    const descriptorB = generateId<DescriptorId>();
    const archivableOn = new Date("2027-01-01T00:00:00Z");

    await schedulerService.scheduleReminders(
      {
        eserviceId,
        descriptorId: descriptorA,
        archivableOn,
        eventType: schedulableEventType.eserviceDescriptorArchivingScheduled,
        reminderDays: [7, 3, 1],
        sendAtHour: 9,
        tz: "Europe/Rome",
        correlationId: generateId<CorrelationId>(),
      },
      genericLogger
    );
    await schedulerService.scheduleReminders(
      {
        eserviceId,
        descriptorId: descriptorB,
        archivableOn,
        eventType: schedulableEventType.eserviceDescriptorArchivingScheduled,
        reminderDays: [7, 3, 1],
        sendAtHour: 9,
        tz: "Europe/Rome",
        correlationId: generateId<CorrelationId>(),
      },
      genericLogger
    );

    await schedulerService.deletePendingByDescriptorScope({
      eserviceId,
      descriptorId: descriptorA,
      eventType: schedulableEventType.eserviceDescriptorArchivingScheduled,
    });

    const remaining = await scheduledNotificationDB
      .select()
      .from(scheduledNotification);
    expect(remaining).toHaveLength(6);
    const remainingEntityIds = new Set(remaining.map((r) => r.entityId));
    expect(remainingEntityIds).toEqual(
      new Set([formatEServiceIdDescriptorId(eserviceId, descriptorB)])
    );
  });

  it("inserts a single row-set (one entityId = eserviceId) for an eservice-scope event", async () => {
    const eserviceId = generateId<EServiceId>();
    const archivableOn = new Date("2027-01-01T00:00:00Z");
    const reminderDays = [7, 3, 1];

    const inserted = await schedulerService.scheduleReminders(
      {
        eserviceId,
        archivableOn,
        eventType: schedulableEventType.eserviceArchivingScheduled,
        reminderDays,
        sendAtHour: 9,
        tz: "Europe/Rome",
        correlationId: generateId<CorrelationId>(),
      },
      genericLogger
    );
    expect(inserted).toBe(reminderDays.length * 2);

    const stored = await scheduledNotificationDB
      .select()
      .from(scheduledNotification);
    expect(stored).toHaveLength(reminderDays.length * 2);
    expect(
      stored.every((r) => r.entityId === formatEServiceEntityId(eserviceId))
    ).toBe(true);
  });

  it("eservice-scope DELETE removes the eservice-scope row(s) (entityId = eserviceId)", async () => {
    const eserviceId = generateId<EServiceId>();
    const archivableOn = new Date("2027-01-01T00:00:00Z");

    await schedulerService.scheduleReminders(
      {
        eserviceId,
        archivableOn,
        eventType: schedulableEventType.eserviceArchivingScheduled,
        reminderDays: [7, 3, 1],
        sendAtHour: 9,
        tz: "Europe/Rome",
        correlationId: generateId<CorrelationId>(),
      },
      genericLogger
    );

    await schedulerService.deletePendingByEserviceScope({
      eserviceId,
      eventType: schedulableEventType.eserviceArchivingScheduled,
    });

    const remaining = await scheduledNotificationDB
      .select()
      .from(scheduledNotification);
    expect(remaining).toHaveLength(0);
  });

  it("DELETE does not affect rows already marked sent_at", async () => {
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const archivableOn = new Date("2027-01-01T00:00:00Z");

    await schedulerService.scheduleReminders(
      {
        eserviceId,
        descriptorId,
        archivableOn,
        eventType: schedulableEventType.eserviceDescriptorArchivingScheduled,
        reminderDays: [7, 3, 1],
        sendAtHour: 9,
        tz: "Europe/Rome",
        correlationId: generateId<CorrelationId>(),
      },
      genericLogger
    );

    // Mark all rows as already sent
    await scheduledNotificationDB
      .update(scheduledNotification)
      .set({ sentAt: new Date() })
      .where(isNull(scheduledNotification.sentAt));

    await schedulerService.deletePendingByDescriptorScope({
      eserviceId,
      descriptorId,
      eventType: schedulableEventType.eserviceDescriptorArchivingScheduled,
    });

    const remaining = await scheduledNotificationDB
      .select()
      .from(scheduledNotification);
    expect(remaining).toHaveLength(6); // none deleted, sent_at protects them
  });

  it("skips reminder rows whose send_at is already past (with margin)", async () => {
    // archivableOn is tomorrow, but the reminder days span past it → all thresholds past
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const archivableOn = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const inserted = await schedulerService.scheduleReminders(
      {
        eserviceId,
        descriptorId,
        archivableOn,
        eventType: schedulableEventType.eserviceDescriptorArchivingScheduled,
        reminderDays: [7, 3], // both before now()
        sendAtHour: 9,
        tz: "Europe/Rome",
        correlationId: generateId<CorrelationId>(),
      },
      genericLogger
    );

    expect(inserted).toBe(0);
    const remaining = await scheduledNotificationDB
      .select()
      .from(scheduledNotification);
    expect(remaining).toHaveLength(0);
  });
});
