import { createSelectSchema } from "drizzle-zod";
import { eserviceTemplateVersionDocumentInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceTemplateVersionDocumentSchema = createSelectSchema(
  eserviceTemplateVersionDocumentInReadmodelEserviceTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});

export type EserviceTemplateVersionDocumentSchema = z.infer<
  typeof EserviceTemplateVersionDocumentSchema
>;
