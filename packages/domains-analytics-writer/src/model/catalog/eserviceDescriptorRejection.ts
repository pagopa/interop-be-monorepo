import { EServiceDescriptorRejectionReasonSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceDescriptorRejectionReasonSchema = z.object({
  eservice_id: z.string(),
  metadata_version: z.number(),
  descriptor_id: z.string(),
  rejection_reason: z.string(),
  rejected_at: z.string(),
});
export type EserviceDescriptorRejectionReasonSchema = z.infer<
  typeof EserviceDescriptorRejectionReasonSchema
>;

export type EserviceDescriptorRejectionReasonMapping = {
  [K in keyof EserviceDescriptorRejectionReasonSchema]: (
    record: EServiceDescriptorRejectionReasonSQL
  ) => EserviceDescriptorRejectionReasonSchema[K];
};
