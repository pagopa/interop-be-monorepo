import { pgSchema, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";

export const notificationSchema = pgSchema("notification");

export const notification = notificationSchema.table("notification", {
  id: uuid().primaryKey().notNull(),
  userId: uuid("user_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  body: varchar("body").notNull(),
  notificationType: varchar("notification_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  readAt: timestamp("read_at", {
    withTimezone: true,
    mode: "string",
  }),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
});

export type NotificationDB = InferSelectModel<typeof notification>;
