import { z } from "zod";
import { EserviceSchema } from "pagopa-interop-kpi-models";

export const EserviceDeletingSchema = EserviceSchema.pick({
  id: true,
  deleted: true,
});
export type EserviceDeletingSchema = z.infer<typeof EserviceDeletingSchema>;
