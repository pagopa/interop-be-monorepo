import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";

export const EserviceTemplateVersionInterfaceSchema = createSelectSchema(
  eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});

export type EserviceTemplateVersionInterfaceSchema = z.infer<
  typeof EserviceTemplateVersionInterfaceSchema
>;

export const EserviceTemplateInterfaceDeletingSchema =
  EserviceTemplateVersionInterfaceSchema.pick({
    id: true,
    deleted: true,
  });
export type EserviceTemplateInterfaceDeletingSchema = z.infer<
  typeof EserviceTemplateInterfaceDeletingSchema
>;
