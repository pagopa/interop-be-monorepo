import { EServiceDescriptorAttributeSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceDescriptorAttributeSchema = z.object({
  eservice_id: z.string(),
  metadata_version: z.number(),
  attribute_id: z.string(),
  descriptor_id: z.string(),
  explicit_attribute_verification: z.coerce.boolean(),
  kind: z.string(),
  group_id: z.number(),
});
export type EserviceDescriptorAttributeSchema = z.infer<
  typeof EserviceDescriptorAttributeSchema
>;

export type EserviceDescriptorAttributeMapping = {
  [K in keyof EserviceDescriptorAttributeSchema]: (
    record: EServiceDescriptorAttributeSQL
  ) => EserviceDescriptorAttributeSchema[K];
};
