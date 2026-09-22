import { EserviceSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const EserviceDeletingSchema = EserviceSchema.pick({
  id: true,
  deleted: true,
});
export type EserviceDeletingSchema = z.infer<typeof EserviceDeletingSchema>;
