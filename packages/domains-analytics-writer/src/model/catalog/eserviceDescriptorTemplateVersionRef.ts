import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  EServiceDescriptorTemplateVersionRefSQL,
} from "pagopa-interop-readmodel-models";

export const EserviceDescriptorTemplateVersionRefSchema = createSelectSchema(
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorTemplateVersionRefSchema = z.infer<
  typeof EserviceDescriptorTemplateVersionRefSchema
>;

export type EserviceDescriptorTemplateVersionRefMapping = {
  [K in keyof EserviceDescriptorTemplateVersionRefSchema]: (
    record: EServiceDescriptorTemplateVersionRefSQL
  ) => EserviceDescriptorTemplateVersionRefSchema[K];
};
