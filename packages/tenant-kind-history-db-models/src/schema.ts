import { timestamp, uuid, varchar, integer } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { tenantKindHistorySchema } from "./pgSchema.js";

export const tenantKindHistory = tenantKindHistorySchema.table("tenant_kind_history", {
  tenantId: uuid("tenant_id").notNull(),
  metadataVersion: integer("metadata_version").notNull(),
  kind: varchar("kind").notNull(),
  modifiedAt: timestamp("modified_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
});

export type TenantKindHistoryDB = InferSelectModel<typeof tenantKindHistory>;
