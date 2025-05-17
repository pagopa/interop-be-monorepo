import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  eserviceDescriptorDocumentInReadmodelCatalog,
  EServiceDescriptorDocumentSQL,
} from "pagopa-interop-readmodel-models";

export const EserviceDescriptorDocumentSchema = createSelectSchema(
  eserviceDescriptorDocumentInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorDocumentSchema = z.infer<
  typeof EserviceDescriptorDocumentSchema
>;

export type EserviceDescriptorDocumentMapping = {
  [K in keyof EserviceDescriptorDocumentSchema]: (
    record: EServiceDescriptorDocumentSQL
  ) => EserviceDescriptorDocumentSchema[K];
};

export const EserviceDescriptorDocumentDeletingSchema =
  EserviceDescriptorDocumentSchema.pick({
    id: true,
    deleted: true,
  });
export type EserviceDescriptorDocumentDeletingSchema = z.infer<
  typeof EserviceDescriptorDocumentDeletingSchema
>;

export type EserviceDescriptorDocumentDeletingMapping = {
  [K in keyof EserviceDescriptorDocumentDeletingSchema]: (
    record: Pick<EServiceDescriptorDocumentSQL, "id">
  ) => EserviceDescriptorDocumentDeletingSchema[K];
};
