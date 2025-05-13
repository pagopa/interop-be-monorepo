import { PurposeVersionDocumentSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeVersionDocumentSchema = z.object({
  purpose_id: z.string().uuid(),
  metadata_version: z.number().int(),
  purpose_version_id: z.string().uuid(),
  id: z.string().uuid(),
  content_type: z.string(),
  path: z.string(),
  created_at: z.string(),
  deleted: z.boolean().default(false).optional(),
});
export type PurposeVersionDocument = z.infer<
  typeof PurposeVersionDocumentSchema
>;

export type PurposeMapping = {
  [K in keyof PurposeVersionDocument]: (
    record: PurposeVersionDocumentSQL
  ) => PurposeVersionDocument[K];
};
