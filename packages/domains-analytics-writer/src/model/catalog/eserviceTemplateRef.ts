import { EServiceTemplateRefSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const eserviceTemplateRefSchema = z.object({
  eservice_template_id: z.string(),
  eservice_id: z.string(),
  metadata_version: z.number(),
  instance_label: z.string().nullable(),
});

type EserviceTemplateRefSchema = z.infer<typeof eserviceTemplateRefSchema>;

export type EserviceTemplateRefMapping = {
  [K in keyof EserviceTemplateRefSchema]: (
    record: EServiceTemplateRefSQL
  ) => EserviceTemplateRefSchema[K];
};
