import { createSelectSchema } from "drizzle-zod";
import { eserviceDescriptorAttributeInReadmodelCatalog } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceDescriptorAttributeSchema = createSelectSchema(
  eserviceDescriptorAttributeInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorAttributeSchema = z.infer<
  typeof EserviceDescriptorAttributeSchema
>;
