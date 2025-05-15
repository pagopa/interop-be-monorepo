import { z } from "zod";
import { AgreementStampSQL } from "pagopa-interop-readmodel-models";

export const AgreementStampSchema = z.object({
  agreement_id: z.string(),
  metadata_version: z.number(),
  who: z.string(),
  delegation_id: z.string().nullable(),
  when: z.string(),
  kind: z.string(),
  deleted: z.boolean().default(false).optional(),
});

export type AgreementStampSchema = z.infer<typeof AgreementStampSchema>;

export type AgreementStampMapping = {
  [K in keyof AgreementStampSchema]: (
    r: AgreementStampSQL
  ) => AgreementStampSchema[K];
};
