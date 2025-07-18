import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceTemplateVersionDocumentInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";

export const EserviceTemplateVersionDocumentSchema = createSelectSchema(
  eserviceTemplateVersionDocumentInReadmodelEserviceTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});

export type EserviceTemplateVersionDocumentSchema = z.infer<
  typeof EserviceTemplateVersionDocumentSchema
>;
