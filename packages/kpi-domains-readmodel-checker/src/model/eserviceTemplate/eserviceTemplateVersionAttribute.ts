import { createSelectSchema } from "drizzle-zod";
import { eserviceTemplateVersionAttributeInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceTemplateVersionAttributeSchema = createSelectSchema(
  eserviceTemplateVersionAttributeInReadmodelEserviceTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceTemplateVersionAttributeSchema = z.infer<
  typeof EserviceTemplateVersionAttributeSchema
>;
