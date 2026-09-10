import { ClientSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const ClientDeletingSchema = ClientSchema.pick({
  id: true,
  deleted: true,
});
export type ClientDeletingSchema = z.infer<typeof ClientDeletingSchema>;
