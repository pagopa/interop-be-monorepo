import { z } from "zod";
import { AgreementAttributeSQL } from "pagopa-interop-readmodel-models";

export const AgreementAttributeSchema = z.object({
  agreement_id: z.string(),
  metadata_version: z.number(),
  attribute_id: z.string(),
  kind: z.string(),
  deleted: z.boolean().default(false).optional(),
});

export type AgreementAttributeSchema = z.infer<typeof AgreementAttributeSchema>;

export type AgreementAttributeMapping = {
  [K in keyof AgreementAttributeSchema]: (
    r: AgreementAttributeSQL
  ) => AgreementAttributeSchema[K];
};
