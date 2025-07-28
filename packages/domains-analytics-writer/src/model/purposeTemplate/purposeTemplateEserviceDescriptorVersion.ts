import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { purposeTemplateEserviceDescriptorVersionInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";

export const PurposeTemplateEServiceDescriptorVersionSchema =
  createSelectSchema(
    purposeTemplateEserviceDescriptorVersionInReadmodelPurposeTemplate
  ).extend({
    deleted: z.boolean().default(false).optional(),
  });
export type PurposeTemplateEServiceDescriptorVersionSchema = z.infer<
  typeof PurposeTemplateEServiceDescriptorVersionSchema
>;
