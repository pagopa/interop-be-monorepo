import { ClientKeySchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

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
