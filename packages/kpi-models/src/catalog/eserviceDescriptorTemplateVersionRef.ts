import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceDescriptorTemplateVersionRefInReadmodelCatalog } from "pagopa-interop-readmodel-models";

export const EserviceDescriptorTemplateVersionRefSchema = createSelectSchema(
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorTemplateVersionRefSchema = z.infer<
  typeof EserviceDescriptorTemplateVersionRefSchema
>;
