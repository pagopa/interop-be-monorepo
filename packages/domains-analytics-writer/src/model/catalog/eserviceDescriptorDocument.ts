import { EServiceDescriptorDocumentSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const eserviceDescriptorDocumentSchema = z.object({
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

type EserviceDescriptorDocumentSchema = z.infer<
  typeof eserviceDescriptorDocumentSchema
>;

export type EserviceDescriptorDocumentMapping = {
  [K in keyof EserviceDescriptorDocumentSchema]: (
    record: EServiceDescriptorDocumentSQL
  ) => EserviceDescriptorDocumentSchema[K];
};
