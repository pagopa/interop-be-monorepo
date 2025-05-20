import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceTemplateVersionAttributeInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";

export const EserviceTemplateVersionAttributeSchema = createSelectSchema(
  eserviceTemplateVersionAttributeInReadmodelEserviceTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceTemplateVersionAttributeSchema = z.infer<
  typeof EserviceTemplateVersionAttributeSchema
>;
