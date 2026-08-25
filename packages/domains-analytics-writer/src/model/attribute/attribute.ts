import { AttributeSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const AttributeDeletingSchema = AttributeSchema.pick({
  id: true,
  deleted: true,
});
export type AttributeDeletingSchema = z.infer<typeof AttributeDeletingSchema>;
