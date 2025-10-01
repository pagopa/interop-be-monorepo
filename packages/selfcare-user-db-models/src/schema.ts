import { uuid, varchar } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { userSchema } from "./pgSchema.js";

export const user = userSchema.table("user", {
  userId: uuid("user_id").primaryKey().notNull(),
  tenantId: uuid("tenant_id").notNull(),
  institutionId: uuid("institution_id").notNull(),
  name: varchar("name").notNull(),
  familyName: varchar("family_name").notNull(),
  email: varchar("email").notNull(),
  productRoles: varchar("product_roles").array().notNull(),
});

export type UserDB = InferSelectModel<typeof user>;
