import { z } from "zod";
import { PurposeSchema } from "pagopa-interop-kpi-models";

export const PurposeDeletingSchema = PurposeSchema.pick({
  id: true,
  deleted: true,
});
export type PurposeDeletingSchema = z.infer<typeof PurposeDeletingSchema>;
