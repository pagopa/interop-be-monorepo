import { z } from "zod";
import { JWKKey } from "../authorization/key.js";

export const DPoPProofHeader = z
  .object({
    typ: z.string(),
    alg: z.string(),
    jwk: JWKKey,
  })
  .strict();
export type DPoPProofHeader = z.infer<typeof DPoPProofHeader>;

export const DPoPProofPayload = z
  .object({
    htm: z.string(),
    htu: z.string(),
    iat: z.number(),
    jti: z.string(),
  })
  .strict();
export type DPoPProofPayload = z.infer<typeof DPoPProofPayload>;

export const DPoPProof = z
  .object({
    header: DPoPProofHeader,
    payload: DPoPProofPayload,
  })
  .strict();
export type DPoPProof = z.infer<typeof DPoPProof>;
