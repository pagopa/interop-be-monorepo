import {
  CatalogTopicConfig,
  KafkaConsumerConfig,
  LoggerConfig,
  ScheduledNotificationDBConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const ReminderConfig = z
  .object({
    ESERVICE_MANUAL_ARCHIVE_REMINDER_DAYS: z.string().default("7,3,1"),
    ESERVICE_DESCRIPTOR_MANUAL_ARCHIVE_REMINDER_DAYS: z
      .string()
      .default("7,3,1"),
    REMINDER_SEND_AT_HOUR: z.coerce.number().min(0).max(23).default(9),
    REMINDER_SEND_AT_TZ: z.string().default("Europe/Rome"),
  })
  .transform((c) => ({
    eserviceManualArchiveReminderDays: parseDayList(
      c.ESERVICE_MANUAL_ARCHIVE_REMINDER_DAYS
    ),
    eserviceDescriptorManualArchiveReminderDays: parseDayList(
      c.ESERVICE_DESCRIPTOR_MANUAL_ARCHIVE_REMINDER_DAYS
    ),
    reminderSendAtHour: c.REMINDER_SEND_AT_HOUR,
    reminderSendAtTz: c.REMINDER_SEND_AT_TZ,
  }));

function parseDayList(raw: string): number[] {
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number.parseInt(s, 10));
  if (list.some((n) => Number.isNaN(n) || n < 0)) {
    throw new Error(
      `Invalid reminder days list: "${raw}" (expected comma-separated non-negative integers)`
    );
  }
  return list;
}

const ScheduledNotificationSchedulerConfig = LoggerConfig.and(
  KafkaConsumerConfig
)
  .and(CatalogTopicConfig)
  .and(ScheduledNotificationDBConfig)
  .and(ReminderConfig);

type ScheduledNotificationSchedulerConfig = z.infer<
  typeof ScheduledNotificationSchedulerConfig
>;

export const config: ScheduledNotificationSchedulerConfig =
  ScheduledNotificationSchedulerConfig.parse(process.env);
