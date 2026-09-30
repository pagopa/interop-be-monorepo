import { EserviceDescriptorInterfaceSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

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
