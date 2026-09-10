import { PurposeTemplateSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const PurposeTemplateDeletingSchema = PurposeTemplateSchema.pick({
  id: true,
  deleted: true,
});
export type PurposeTemplateDeletingSchema = z.infer<
  typeof PurposeTemplateDeletingSchema
>;
