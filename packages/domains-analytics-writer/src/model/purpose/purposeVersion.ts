import { PurposeVersionSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeVersionSchema = z.object({
  id: z.string().uuid(),
  purpose_id: z.string().uuid(),
  metadata_version: z.number().int(),
  state: z.string(),
  daily_calls: z.number().int(),
  rejection_reason: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  first_activation_at: z.string().nullable(),
  suspended_at: z.string().nullable(),
  deleted: z.boolean().default(false).optional(),
});
export type PurposeVersionSchema = z.infer<typeof PurposeVersionSchema>;

export type PurposeVersionMapping = {
  [K in keyof PurposeVersionSchema]: (
    record: PurposeVersionSQL
  ) => PurposeVersionSchema[K];
};
