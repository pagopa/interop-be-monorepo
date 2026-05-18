import { addMinutes } from "date-fns";
import { and, eq, isNull, like, sql } from "drizzle-orm";
import { Logger } from "pagopa-interop-commons";
import { DescriptorId, EServiceId } from "pagopa-interop-models";
import {
  NewScheduledNotificationRow,
  SchedulableEventType,
  ScheduledNotificationChannel,
  ScheduledNotificationDrizzleReturnType,
  composeEntityId,
  eserviceEntityIdPrefix,
  scheduledNotification,
  scheduledNotificationChannel,
} from "pagopa-interop-scheduled-notification-db-models";
import { computeSendAt } from "./sendAtCalculator.js";

const SEND_AT_MARGIN_MINUTES = 5;

export type ScheduleRemindersParams = {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  archivableOn: Date;
  eventType: SchedulableEventType;
  reminderDays: number[];
  sendAtHour: number;
  tz: string;
  now?: Date;
};

export type DeletePendingByEserviceScopeParams = {
  eserviceId: EServiceId;
  eventType: SchedulableEventType;
};

export type DeletePendingByDescriptorScopeParams = {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  eventType: SchedulableEventType;
};

export const schedulerServiceBuilder = (
  db: ScheduledNotificationDrizzleReturnType
) => {
  const buildRowsForChannels = ({
    eserviceId,
    descriptorId,
    archivableOn,
    eventType,
    reminderDays,
    sendAtHour,
    tz,
    now,
  }: ScheduleRemindersParams): NewScheduledNotificationRow[] => {
    const entityId = composeEntityId(eserviceId, descriptorId);
    const cutoff = addMinutes(now ?? new Date(), SEND_AT_MARGIN_MINUTES);
    const channels: ScheduledNotificationChannel[] = [
      scheduledNotificationChannel.inApp,
      scheduledNotificationChannel.email,
    ];

    return reminderDays
      .map((daysBeforeArchive) => ({
        sendAt: computeSendAt({
          archivableOn,
          daysBeforeArchive,
          sendAtHour,
          tz,
        }),
        daysBeforeArchive,
      }))
      .filter(({ sendAt }) => sendAt > cutoff)
      .flatMap(({ sendAt }) =>
        channels.map((channel) => ({
          channel,
          eventType,
          entityId,
          sendAt,
        }))
      );
  };

  return {
    async scheduleReminders(
      params: ScheduleRemindersParams,
      log: Logger
    ): Promise<number> {
      const rows = buildRowsForChannels(params);
      if (rows.length === 0) {
        log.info(
          `No reminders to schedule for ${params.eventType} (eservice=${params.eserviceId}, descriptor=${params.descriptorId}): all thresholds already past`
        );
        return 0;
      }
      await db
        .insert(scheduledNotification)
        .values(rows)
        .onConflictDoNothing({
          target: [
            scheduledNotification.channel,
            scheduledNotification.eventType,
            scheduledNotification.entityId,
            scheduledNotification.sendAt,
          ],
        });
      log.info(
        `Scheduled ${rows.length} reminder rows for ${params.eventType} (eservice=${params.eserviceId}, descriptor=${params.descriptorId})`
      );
      return rows.length;
    },

    async deletePendingByEserviceScope({
      eserviceId,
      eventType,
    }: DeletePendingByEserviceScopeParams): Promise<void> {
      await db
        .delete(scheduledNotification)
        .where(
          and(
            eq(scheduledNotification.eventType, eventType),
            like(
              scheduledNotification.entityId,
              `${eserviceEntityIdPrefix(eserviceId)}%`
            ),
            isNull(scheduledNotification.sentAt)
          )
        );
    },

    async deletePendingByDescriptorScope({
      eserviceId,
      descriptorId,
      eventType,
    }: DeletePendingByDescriptorScopeParams): Promise<void> {
      await db
        .delete(scheduledNotification)
        .where(
          and(
            eq(scheduledNotification.eventType, eventType),
            eq(
              scheduledNotification.entityId,
              composeEntityId(eserviceId, descriptorId)
            ),
            isNull(scheduledNotification.sentAt)
          )
        );
    },

    async countPending(): Promise<number> {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(scheduledNotification)
        .where(isNull(scheduledNotification.sentAt));
      return result[0]?.count ?? 0;
    },
  };
};

export type SchedulerService = ReturnType<typeof schedulerServiceBuilder>;
