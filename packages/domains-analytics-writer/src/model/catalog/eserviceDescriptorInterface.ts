import { EServiceDescriptorInterfaceSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceDescriptorInterfaceSchema = z.object({
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
export type EserviceDescriptorInterfaceSchema = z.infer<
  typeof EserviceDescriptorInterfaceSchema
>;

export type EserviceDescriptorInterfaceMapping = {
  [K in keyof EserviceDescriptorInterfaceSchema]: (
    record: EServiceDescriptorInterfaceSQL
  ) => EserviceDescriptorInterfaceSchema[K];
};
