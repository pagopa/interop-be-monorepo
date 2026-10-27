import { InferSelectModel } from "drizzle-orm";
import { timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { personalDataSchema } from "./pgSchema.js";

export const contact = personalDataSchema.table("contact", {
  id: uuid().primaryKey().notNull(),
  email: varchar().notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
});

export type ContactDB = InferSelectModel<typeof contact>;
