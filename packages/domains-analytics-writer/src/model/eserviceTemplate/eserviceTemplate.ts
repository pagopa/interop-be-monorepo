import { EserviceTemplateSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const EserviceTemplateDeletingSchema = EserviceTemplateSchema.pick({
  id: true,
  deleted: true,
});
export type EserviceTemplateDeletingSchema = z.infer<
  typeof EserviceTemplateDeletingSchema
>;
