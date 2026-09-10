import { PurposeSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const PurposeDeletingSchema = PurposeSchema.pick({
  id: true,
  deleted: true,
});
export type PurposeDeletingSchema = z.infer<typeof PurposeDeletingSchema>;
