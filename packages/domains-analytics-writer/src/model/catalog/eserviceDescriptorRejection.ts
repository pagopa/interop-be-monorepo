import { EServiceDescriptorRejectionReasonSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const eserviceDescriptorRejectionReasonSchema = z.object({
  eservice_id: z.string(),
  metadata_version: z.number(),
  descriptor_id: z.string(),
  rejection_reason: z.string(),
  rejected_at: z.string(),
});

type eserviceDescriptorRejectionReasonSchema = z.infer<
  typeof eserviceDescriptorRejectionReasonSchema
>;

export type EserviceDescriptorRejectionMapping = {
  [K in keyof eserviceDescriptorRejectionReasonSchema]: (
    record: EServiceDescriptorRejectionReasonSQL
  ) => eserviceDescriptorRejectionReasonSchema[K];
};
