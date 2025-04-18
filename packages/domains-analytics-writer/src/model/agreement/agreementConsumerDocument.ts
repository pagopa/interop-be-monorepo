import { z } from "zod";
import { AgreementConsumerDocumentSQL } from "pagopa-interop-readmodel-models";

export const agreementConsumerDocumentSchema = z.object({
  id: z.string(),
  agreement_id: z.string(),
  metadata_version: z.number(),
  name: z.string(),
  pretty_name: z.string(),
  content_type: z.string(),
  path: z.string(),
  created_at: z.string(),
  deleted: z.boolean().default(false).optional(),
});

type DocSchema = z.infer<typeof agreementConsumerDocumentSchema>;
export type AgreementConsumerDocumentMapping = {
  [K in keyof DocSchema]: (r: AgreementConsumerDocumentSQL) => DocSchema[K];
};
