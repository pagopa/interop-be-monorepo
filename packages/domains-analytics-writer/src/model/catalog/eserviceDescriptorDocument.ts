import { z } from "zod";
import { EserviceDescriptorDocumentSchema } from "pagopa-interop-kpi-models";

export const EserviceDescriptorDocumentDeletingSchema =
  EserviceDescriptorDocumentSchema.pick({
    id: true,
    deleted: true,
  });
export type EserviceDescriptorDocumentDeletingSchema = z.infer<
  typeof EserviceDescriptorDocumentDeletingSchema
>;
