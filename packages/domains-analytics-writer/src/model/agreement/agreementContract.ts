import { z } from "zod";
import { AgreementContractSQL } from "pagopa-interop-readmodel-models";

export const agreementContractSchema = z.object({
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

type ContractSchema = z.infer<typeof agreementContractSchema>;
export type AgreementContractMapping = {
  [K in keyof ContractSchema]: (r: AgreementContractSQL) => ContractSchema[K];
};
