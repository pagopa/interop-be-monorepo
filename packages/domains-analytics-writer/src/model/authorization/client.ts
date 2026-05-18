import { z } from "zod";
import { ClientSchema } from "pagopa-interop-kpi-models";

export const ClientDeletingSchema = ClientSchema.pick({
  id: true,
  deleted: true,
});
export type ClientDeletingSchema = z.infer<typeof ClientDeletingSchema>;
