import { createSelectSchema } from "drizzle-zod";
import { eserviceDescriptorDocumentInReadmodelCatalog } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceDescriptorDocumentSchema = createSelectSchema(
  eserviceDescriptorDocumentInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorDocumentSchema = z.infer<
  typeof EserviceDescriptorDocumentSchema
>;

export const EserviceDescriptorDocumentDeletingSchema =
  EserviceDescriptorDocumentSchema.pick({
    id: true,
    deleted: true,
  });
export type EserviceDescriptorDocumentDeletingSchema = z.infer<
  typeof EserviceDescriptorDocumentDeletingSchema
>;
