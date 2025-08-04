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

export const EserviceTemplateDocumentDeletingSchema =
  EserviceTemplateVersionDocumentSchema.pick({
    id: true,
    deleted: true,
  });
export type EserviceTemplateDocumentDeletingSchema = z.infer<
  typeof EserviceTemplateDocumentDeletingSchema
>;
