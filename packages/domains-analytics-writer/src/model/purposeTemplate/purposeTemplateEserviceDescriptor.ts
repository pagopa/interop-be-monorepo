import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";
// TODO: to update or remove?
export const PurposeTemplateEServiceDescriptorSchema = createSelectSchema(
  purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeTemplateEServiceDescriptorSchema = z.infer<
  typeof PurposeTemplateEServiceDescriptorSchema
>;
