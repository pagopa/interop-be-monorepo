import { z } from "zod";
import { PurposeTemplateEServiceDescriptorSchema } from "pagopa-interop-kpi-models";

export const PurposeTemplateEServiceDescriptorDeletingSchema =
  PurposeTemplateEServiceDescriptorSchema.pick({
    purposeTemplateId: true,
    eserviceId: true,
    descriptorId: true,
    deleted: true,
  });
export type PurposeTemplateEServiceDescriptorDeletingSchema = z.infer<
  typeof PurposeTemplateEServiceDescriptorDeletingSchema
>;
