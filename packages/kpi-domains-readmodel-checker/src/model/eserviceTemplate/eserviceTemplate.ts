import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceTemplateInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";

export const EserviceTemplateSchema = createSelectSchema(
  eserviceTemplateInReadmodelEserviceTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceTemplateSchema = z.infer<typeof EserviceTemplateSchema>;
