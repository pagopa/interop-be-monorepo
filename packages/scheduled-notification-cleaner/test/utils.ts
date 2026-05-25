import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach, beforeEach, vi } from "vitest";
import {
  NotificationId,
  generateId,
  EServiceId,
  DescriptorId,
} from "pagopa-interop-models";
import {
  schedulableEventType,
  SchedulableEventType,
  scheduledNotification,
  ScheduledNotificationChannel,
} from "pagopa-interop-scheduled-notification-db-models";

export const { cleanup, scheduledNotificationDB } =
  await setupTestContainersVitest(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    inject("scheduledNotificationDbConfig")
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date());
});

afterEach(async () => {
  vi.useRealTimers();
  await cleanup();
});

interface MockNotification {
  id: NotificationId;
  channel: ScheduledNotificationChannel;
  eventType: SchedulableEventType;
  entityId: string;
  correlationId: string;
  sendAt: Date;
  sentAt: Date | null;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
}

export const addScheduledNotifications = async (
  notifications: MockNotification[]
): Promise<void> => {
  await scheduledNotificationDB
    .insert(scheduledNotification)
    .values(notifications);
};

export const getMockNotification = ({
  id = generateId<NotificationId>(),
  channel = "email" as ScheduledNotificationChannel,
  eventType = schedulableEventType.eserviceArchivingScheduled as SchedulableEventType,
  entityId = `${generateId<EServiceId>()}/${generateId<DescriptorId>()}`,
  correlationId = generateId(),
  sendAt = new Date(),
  sentAt = null,
  attempts = 0,
  lastError = null,
  createdAt = new Date(),
}: {
  id?: NotificationId;
  channel?: ScheduledNotificationChannel;
  eventType?: SchedulableEventType;
  entityId?: string;
  correlationId?: string;
  sendAt?: Date;
  sentAt?: Date | null;
  attempts?: number;
  lastError?: string | null;
  createdAt?: Date;
}): MockNotification => ({
  id,
  channel,
  eventType,
  entityId,
  correlationId,
  sendAt,
  sentAt,
  attempts,
  lastError,
  createdAt,
});
