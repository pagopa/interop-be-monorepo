import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceDescriptorInReadmodelCatalog } from "pagopa-interop-readmodel-models";
import { EserviceDescriptorAttributeSchema } from "./eserviceDescriptorAttribute.js";
import { EserviceDescriptorDocumentSchema } from "./eserviceDescriptorDocument.js";
import { EserviceDescriptorInterfaceSchema } from "./eserviceDescriptorInterface.js";
import { EserviceDescriptorRejectionReasonSchema } from "./eserviceDescriptorRejection.js";
import { EserviceDescriptorTemplateVersionRefSchema } from "./eserviceDescriptorTemplateVersionRef.js";

export const EserviceDescriptorSchema = createSelectSchema(
  eserviceDescriptorInReadmodelCatalog
)
  .omit({ audience: true, serverUrls: true })
  .extend({
    deleted: z.boolean().default(false).optional(),
    audience: z
      .array(z.string())
      .transform((val) => JSON.stringify(val))
      .pipe(z.string()),
    serverUrls: z
      .array(z.string())
      .transform((val) => JSON.stringify(val))
      .pipe(z.string()),
  });
export type EserviceDescriptorSchema = z.infer<typeof EserviceDescriptorSchema>;

export const EserviceDescriptorServerUrlsSchema = EserviceDescriptorSchema.pick(
  {
    id: true,
    serverUrls: true,
    metadataVersion: true,
    deleted: true,
  }
);
export type EserviceDescriptorServerUrlsSchema = z.infer<
  typeof EserviceDescriptorServerUrlsSchema
>;

export const EserviceDescriptorDeletingSchema = EserviceDescriptorSchema.pick({
  id: true,
  deleted: true,
});
export type EserviceDescriptorDeletingSchema = z.infer<
  typeof EserviceDescriptorDeletingSchema
>;

export const EserviceDescriptorItemsSchema = z.object({
  descriptorSQL: EserviceDescriptorSchema,
  attributesSQL: z.array(EserviceDescriptorAttributeSchema),
  interfaceSQL: EserviceDescriptorInterfaceSchema.optional(),
  documentsSQL: z.array(EserviceDescriptorDocumentSchema),
  rejectionReasonsSQL: z.array(EserviceDescriptorRejectionReasonSchema),
  templateVersionRefSQL: EserviceDescriptorTemplateVersionRefSchema.optional(),
});
export type EserviceDescriptorItemsSchema = z.infer<
  typeof EserviceDescriptorItemsSchema
>;
