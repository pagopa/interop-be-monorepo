import { EServiceDescriptorRejectionReasonSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const eserviceDescriptorRejectionSchema = z.object({
  eservice_id: z.string(),
  metadata_version: z.number(),
  descriptor_id: z.string(),
  rejection_reason: z.string(),
  rejected_at: z.string(),
});

type EserviceDescriptorRejectionSchema = z.infer<
  typeof eserviceDescriptorRejectionSchema
>;

export type EserviceDescriptorRejectionMapping = {
  [K in keyof EserviceDescriptorRejectionSchema]: (
    record: EServiceDescriptorRejectionReasonSQL
  ) => EserviceDescriptorRejectionSchema[K];
};
