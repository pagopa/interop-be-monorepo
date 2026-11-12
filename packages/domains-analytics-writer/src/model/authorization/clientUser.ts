import { ClientUserSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const ClientUserDeletingSchema = ClientUserSchema.pick({
  clientId: true,
  userId: true,
  deleted: true,
});
export type ClientUserDeletingSchema = z.infer<typeof ClientUserDeletingSchema>;
