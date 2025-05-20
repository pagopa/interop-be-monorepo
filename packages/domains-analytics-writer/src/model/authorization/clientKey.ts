import { createSelectSchema } from "drizzle-zod";
import { clientKeyInReadmodelClient } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const ClientKeySchema = createSelectSchema(
  clientKeyInReadmodelClient
).extend({
  deactivationTimestamp: z.string().optional(),
  deleted: z.boolean().default(false).optional(),
});
export type ClientKeySchema = z.infer<typeof ClientKeySchema>;

export const ClientKeyDeletingSchema = ClientKeySchema.pick({
  clientId: true,
  kid: true,
  deactivationTimestamp: true,
  deleted: true,
});
export type ClientKeyDeletingSchema = z.infer<typeof ClientKeyDeletingSchema>;

export const ClientKeyUserMigrationSchema = ClientKeySchema.pick({
  clientId: true,
  kid: true,
  userId: true,
  metadataVersion: true,
}).extend({
  migratedUserAt: z.string(),
});
export type ClientKeyUserMigrationSchema = z.infer<
  typeof ClientKeyUserMigrationSchema
>;
