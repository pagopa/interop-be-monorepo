import { createSelectSchema } from "drizzle-zod";
import { eserviceTemplateVersionPurposeTemplateInReadmodelPurposeTemplate as purposeTemplateEserviceTemplateVersionInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeTemplateEserviceTemplateVersionSchema = createSelectSchema(
  purposeTemplateEserviceTemplateVersionInReadmodelPurposeTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeTemplateEserviceTemplateVersionSchema = z.infer<
  typeof PurposeTemplateEserviceTemplateVersionSchema
>;
