import { z } from "zod";
import { PurposeTemplateSchema } from "pagopa-interop-kpi-models";

export const PurposeTemplateDeletingSchema = PurposeTemplateSchema.pick({
  id: true,
  deleted: true,
});
export type PurposeTemplateDeletingSchema = z.infer<
  typeof PurposeTemplateDeletingSchema
>;
