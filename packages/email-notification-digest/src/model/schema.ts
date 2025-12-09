import { uuid, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { digestTrackingSchema } from "./digestTrackingSchema.js";

export const digestEmailSent = digestTrackingSchema.table(
  "digest_email_sent",
  {
    userId: uuid("user_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tenantId] })]
);

export type DigestEmailSentInsert = InferInsertModel<typeof digestEmailSent>;
export type DigestEmailSentSelect = InferSelectModel<typeof digestEmailSent>;
