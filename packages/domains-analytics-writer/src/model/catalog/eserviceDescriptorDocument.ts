import { EserviceDescriptorDocumentSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const EserviceDescriptorDocumentDeletingSchema =
  EserviceDescriptorDocumentSchema.pick({
    id: true,
    deleted: true,
  });
export type EserviceDescriptorDocumentDeletingSchema = z.infer<
  typeof EserviceDescriptorDocumentDeletingSchema
>;
