import { z } from "zod";

export const SqsSafeStorageBodySchema = z.object({
  version: z.string(),
  id: z.string().uuid(),
  "detail-type": z.string(),
  source: z.string(),
  account: z.string(),
  time: z.string().datetime(),
  region: z.string(),
  resources: z.array(z.any()),
  detail: z.object({
    key: z.string(),
    versionId: z.string(),
    documentType: z.enum([
      "RISK_ANALYSIS_DOCUMENT",
      "AGREEMENT_CONTRACT",
      "DELEGATION_CONTRACT",
      "VOUCHER_AUDIT",
      "EVENT_JOURNAL",
    ]),
    documentStatus: z.literal("SAVED"),
    contentType: z.literal("application/pdf"),
    checksum: z.string(),
    retentionUntil: z.string().datetime(),
    tags: z.nullable(z.any()),
    client_short_code: z.string(),
  }),
});

export type SqsSafeStorageBody = z.infer<typeof SqsSafeStorageBodySchema>;
