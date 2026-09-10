import { createSelectSchema } from "drizzle-zod";
import { eserviceDescriptorTemplateVersionRefInReadmodelCatalog } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceDescriptorTemplateVersionRefSchema = createSelectSchema(
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorTemplateVersionRefSchema = z.infer<
  typeof EserviceDescriptorTemplateVersionRefSchema
>;
