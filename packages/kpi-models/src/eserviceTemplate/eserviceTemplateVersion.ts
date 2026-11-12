import { createSelectSchema } from "drizzle-zod";
import { eserviceTemplateVersionInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceTemplateVersionSchema = createSelectSchema(
  eserviceTemplateVersionInReadmodelEserviceTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});

export type EserviceTemplateVersionSchema = z.infer<
  typeof EserviceTemplateVersionSchema
>;
