import { z } from "zod";
import {
  EserviceDescriptorSchema,
  EserviceDescriptorAttributeSchema,
  EserviceDescriptorDocumentSchema,
  EserviceDescriptorInterfaceSchema,
  EserviceDescriptorRejectionReasonSchema,
  EserviceDescriptorTemplateVersionRefSchema,
} from "pagopa-interop-kpi-models";

export const EserviceDescriptorServerUrlsSchema = EserviceDescriptorSchema.pick(
  {
    id: true,
    serverUrls: true,
    metadataVersion: true,
    deleted: true,
  }
);
export type EserviceDescriptorServerUrlsSchema = z.infer<
  typeof EserviceDescriptorServerUrlsSchema
>;

export const EserviceDescriptorDeletingSchema = EserviceDescriptorSchema.pick({
  id: true,
  deleted: true,
});
export type EserviceDescriptorDeletingSchema = z.infer<
  typeof EserviceDescriptorDeletingSchema
>;

export const EserviceDescriptorItemsSchema = z.object({
  descriptorSQL: EserviceDescriptorSchema,
  attributesSQL: z.array(EserviceDescriptorAttributeSchema),
  interfaceSQL: EserviceDescriptorInterfaceSchema.optional(),
  documentsSQL: z.array(EserviceDescriptorDocumentSchema),
  rejectionReasonsSQL: z.array(EserviceDescriptorRejectionReasonSchema),
  templateVersionRefSQL: EserviceDescriptorTemplateVersionRefSchema.optional(),
});
export type EserviceDescriptorItemsSchema = z.infer<
  typeof EserviceDescriptorItemsSchema
>;
