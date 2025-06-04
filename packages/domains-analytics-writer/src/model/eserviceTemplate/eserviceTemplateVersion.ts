import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceTemplateVersionInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";

export const EserviceTemplateVersionSchema = createSelectSchema(
  eserviceTemplateVersionInReadmodelEserviceTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});

export type EserviceTemplateVersionSchema = z.infer<
  typeof EserviceTemplateVersionSchema
>;

export const EserviceTemplateVersionDeletingSchema =
  EserviceTemplateVersionSchema.pick({
    id: true,
    deleted: true,
  });
export type EserviceTemplateVersionDeletingSchema = z.infer<
  typeof EserviceTemplateVersionDeletingSchema
>;
