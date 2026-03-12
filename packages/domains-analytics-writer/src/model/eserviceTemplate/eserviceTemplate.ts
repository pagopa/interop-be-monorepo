import { z } from "zod";
import { EserviceTemplateSchema } from "pagopa-interop-kpi-models";

export const EserviceTemplateDeletingSchema = EserviceTemplateSchema.pick({
  id: true,
  deleted: true,
});
export type EserviceTemplateDeletingSchema = z.infer<
  typeof EserviceTemplateDeletingSchema
>;
