import { InferSelectModel } from "drizzle-orm";
import { timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { contactDataSchema } from "./pgSchema.js";

export const contact = contactDataSchema.table("contact", {
  id: uuid().primaryKey().notNull(),
  email: varchar().notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
});

export type ContactDB = InferSelectModel<typeof contact>;
