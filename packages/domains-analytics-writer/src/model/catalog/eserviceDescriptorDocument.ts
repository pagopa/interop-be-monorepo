import { EServiceDescriptorDocumentSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceDescriptorDocumentSchema = z.object({
  id: z.string(),
  eservice_id: z.string(),
  metadata_version: z.number(),
  descriptor_id: z.string(),
  name: z.string(),
  content_type: z.string(),
  pretty_name: z.string(),
  path: z.string(),
  checksum: z.string(),
  upload_date: z.string(),
});
export type EserviceDescriptorDocumentSchema = z.infer<
  typeof EserviceDescriptorDocumentSchema
>;

export type EserviceDescriptorDocumentMapping = {
  [K in keyof EserviceDescriptorDocumentSchema]: (
    record: EServiceDescriptorDocumentSQL
  ) => EserviceDescriptorDocumentSchema[K];
};

export const EserviceDescriptorDocumentDeletingSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});
export type EserviceDescriptorDocumentDeletingSchema = z.infer<
  typeof EserviceDescriptorDocumentDeletingSchema
>;
