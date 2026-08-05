import { sql } from "drizzle-orm";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { scheduledNotificationSchema } from "./pgSchema.js";

export const scheduledNotification = scheduledNotificationSchema.table(
  "scheduled_notification",
  {
    id: uuid("id").primaryKey().notNull(),
    channel: varchar("channel").notNull(),
    eventType: varchar("event_type").notNull(),
    entityId: varchar("entity_id").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("scheduled_notification_uq").on(
      t.channel,
      t.eventType,
      t.entityId,
      t.sendAt
    ),
    index("scheduled_notification_due_idx")
      .on(t.channel, t.sendAt)
      .where(sql`${t.sentAt} IS NULL AND ${t.skippedAt} IS NULL`),
  ]
);

export type ScheduledNotificationRow = InferSelectModel<
  typeof scheduledNotification
>;

export type NewScheduledNotificationRow = InferInsertModel<
  typeof scheduledNotification
>;
