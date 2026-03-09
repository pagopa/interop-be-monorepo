import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { purposeTemplateInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";

export const PurposeTemplateSchema = createSelectSchema(
  purposeTemplateInReadmodelPurposeTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeTemplateSchema = z.infer<typeof PurposeTemplateSchema>;
