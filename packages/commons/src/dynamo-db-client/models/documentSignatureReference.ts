import { z } from "zod";

export const DocumentSignatureReferenceSchema = z.object({
  safeStorageId: z.string(),
  fileKind: z.string(),
  streamId: z.string(),
  subObjectId: z.string(),
  contentType: z.string(),
  path: z.string(),
  prettyname: z.string(),
  fileName: z.string(),
  version: z.number(),
  createdAt: z.union([z.bigint(), z.number().transform((n) => BigInt(n))]),
  correlationId: z.string(),
  creationTimestamp: z.number().optional(),
});

export type DocumentSignatureReference = z.infer<
  typeof DocumentSignatureReferenceSchema
>;
