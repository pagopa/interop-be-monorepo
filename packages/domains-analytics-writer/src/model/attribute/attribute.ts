import { z } from "zod";
import { AttributeSchema } from "pagopa-interop-kpi-models";

export const AttributeDeletingSchema = AttributeSchema.pick({
  id: true,
  deleted: true,
});
export type AttributeDeletingSchema = z.infer<typeof AttributeDeletingSchema>;
