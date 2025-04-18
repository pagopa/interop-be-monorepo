import { z } from "zod";
import { AgreementStampSQL } from "pagopa-interop-readmodel-models";

export const agreementStampSchema = z.object({
  agreement_id: z.string(),
  metadata_version: z.number(),
  who: z.string(),
  delegation_id: z.string().nullable(),
  when: z.string(), // ISO timestamp string
  kind: z.string(),
  deleted: z.boolean().default(false).optional(),
});

type StampSchema = z.infer<typeof agreementStampSchema>;
export type AgreementStampMapping = {
  [K in keyof StampSchema]: (r: AgreementStampSQL) => StampSchema[K];
};
