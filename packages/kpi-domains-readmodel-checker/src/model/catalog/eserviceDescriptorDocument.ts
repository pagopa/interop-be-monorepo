import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceDescriptorDocumentInReadmodelCatalog } from "pagopa-interop-readmodel-models";

export const EserviceDescriptorDocumentSchema = createSelectSchema(
  eserviceDescriptorDocumentInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorDocumentSchema = z.infer<
  typeof EserviceDescriptorDocumentSchema
>;
