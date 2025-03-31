import { EServiceDescriptorAttributeSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const eserviceDescriptorAttributeSchema = z.object({
  eservice_id: z.string(),
  metadata_version: z.number(),
  attribute_id: z.string(),
  descriptor_id: z.string(),
  explicit_attribute_verification: z.coerce.boolean(),
  kind: z.string(),
  group_id: z.number(),
});

type EserviceDescriptorAttributeSchema = z.infer<
  typeof eserviceDescriptorAttributeSchema
>;

export type EserviceDescriptorAttributeMapping = {
  [K in keyof EserviceDescriptorAttributeSchema]: (
    record: EServiceDescriptorAttributeSQL
  ) => EserviceDescriptorAttributeSchema[K];
};
