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
    documentType: z.literal("INTEROP_LEGAL_FACTS"),
    documentStatus: z.literal("SAVED"),
    contentType: z.string(),
    checksum: z.string(),
    retentionUntil: z.string().datetime(),
    tags: z.nullable(z.any()),
    client_short_code: z.string(),
  }),
});

export type SqsSafeStorageBody = z.infer<typeof SqsSafeStorageBodySchema>;
