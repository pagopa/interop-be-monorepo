import { z } from "zod";
import { AgreementAttributeSQL } from "pagopa-interop-readmodel-models";

export const agreementAttributeSchema = z.object({
  agreement_id: z.string(),
  metadata_version: z.number(),
  attribute_id: z.string(),
  kind: z.string(),
  deleted: z.boolean().default(false).optional(),
});

type AttrSchema = z.infer<typeof agreementAttributeSchema>;
export type AgreementAttributeMapping = {
  [K in keyof AttrSchema]: (r: AgreementAttributeSQL) => AttrSchema[K];
};
