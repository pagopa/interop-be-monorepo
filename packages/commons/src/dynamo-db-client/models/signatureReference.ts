import { z } from "zod";

export const SignatureReferenceSchema = z.object({
  safeStorageId: z.string(),
  fileKind: z.string(),
  fileName: z.string(),
  path: z.string(),
  correlationId: z.string(),
  creationTimestamp: z.number().optional(),
});

export type SignatureReference = z.infer<typeof SignatureReferenceSchema>;
