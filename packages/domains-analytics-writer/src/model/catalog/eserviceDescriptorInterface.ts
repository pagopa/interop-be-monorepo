import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceDescriptorInterfaceInReadmodelCatalog } from "pagopa-interop-readmodel-models";

export const EserviceDescriptorInterfaceSchema = createSelectSchema(
  eserviceDescriptorInterfaceInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDescriptorInterfaceSchema = z.infer<
  typeof EserviceDescriptorInterfaceSchema
>;

export const EserviceDescriptorInterfaceItemsSchema = z.object({
  interfaceSQL: EserviceDescriptorInterfaceSchema.optional(),
});
export type EserviceDescriptorInterfaceItemsSchema = z.infer<
  typeof EserviceDescriptorInterfaceSchema
>;

export const EserviceDescriptorDocumentOrInterfaceDeletingSchema =
  EserviceDescriptorInterfaceSchema.pick({
    id: true,
    descriptorId: true,
    metadataVersion: true,
    deleted: true,
  });
export type EserviceDescriptorDocumentOrInterfaceDeletingSchema = z.infer<
  typeof EserviceDescriptorDocumentOrInterfaceDeletingSchema
>;
