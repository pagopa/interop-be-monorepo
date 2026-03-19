import { z } from "zod";
import { ClientUserSchema } from "pagopa-interop-kpi-models";

export const ClientUserDeletingSchema = ClientUserSchema.pick({
  clientId: true,
  userId: true,
  deleted: true,
});
export type ClientUserDeletingSchema = z.infer<typeof ClientUserDeletingSchema>;
