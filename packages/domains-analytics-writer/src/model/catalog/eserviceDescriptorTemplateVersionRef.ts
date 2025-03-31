import { EServiceDescriptorTemplateVersionRefSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const eserviceDescriptorTemplateVersionRefSchema = z.object({
  eservice_template_version_id: z.string(),
  eservice_id: z.string(),
  metadata_version: z.number(),
  descriptor_id: z.string(),
  contact_name: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_url: z.string().nullable(),
  terms_and_conditions_url: z.string().nullable(),
});

type EserviceDescriptorTemplateVersionRefSchema = z.infer<
  typeof eserviceDescriptorTemplateVersionRefSchema
>;

export type EserviceDescriptorTemplateVersionRefMapping = {
  [K in keyof EserviceDescriptorTemplateVersionRefSchema]: (
    record: EServiceDescriptorTemplateVersionRefSQL
  ) => EserviceDescriptorTemplateVersionRefSchema[K];
};
