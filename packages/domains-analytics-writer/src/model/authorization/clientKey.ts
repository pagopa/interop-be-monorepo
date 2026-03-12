import { createSelectSchema } from "drizzle-zod";
import { clientKeyInReadmodelClient } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const ClientKeySchema = createSelectSchema(
  clientKeyInReadmodelClient
).extend({
  deleted: z.boolean().default(false).optional(),
  deleted_at: z.string().optional(),
});
export type ClientKeySchema = z.infer<typeof ClientKeySchema>;

export const ClientKeyDeletingSchema = ClientKeySchema.pick({
  clientId: true,
  kid: true,
  deleted: true,
  deleted_at: true,
});
export type ClientKeyDeletingSchema = z.infer<typeof ClientKeyDeletingSchema>;

export const ClientKeyUserMigrationSchema = ClientKeySchema.pick({
  clientId: true,
  kid: true,
  userId: true,
  metadataVersion: true,
});
export type ClientKeyUserMigrationSchema = z.infer<
  typeof ClientKeyUserMigrationSchema
>;
