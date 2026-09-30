import { createSelectSchema } from "drizzle-zod";
import { eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceTemplateVersionInterfaceSchema = createSelectSchema(
  eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});

export type EserviceTemplateVersionInterfaceSchema = z.infer<
  typeof EserviceTemplateVersionInterfaceSchema
>;
