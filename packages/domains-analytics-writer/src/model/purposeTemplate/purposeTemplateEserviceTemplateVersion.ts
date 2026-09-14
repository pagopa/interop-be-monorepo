import { PurposeTemplateEserviceTemplateVersionSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const PurposeTemplateEserviceTemplateVersionDeletingSchema =
  PurposeTemplateEserviceTemplateVersionSchema.pick({
    purposeTemplateId: true,
    eserviceTemplateId: true,
    eserviceTemplateVersionId: true,
    deleted: true,
  });
export type PurposeTemplateEserviceTemplateVersionDeletingSchema = z.infer<
  typeof PurposeTemplateEserviceTemplateVersionDeletingSchema
>;
