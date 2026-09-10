import { PurposeTemplateEServiceDescriptorSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

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
