import { z } from "zod";
import { JWKKey, JWKKeyES } from "../authorization/key.js";

export const algorithm = {
  RS256: "RS256",
  ES256: "ES256",
} as const;
export const Algorithm = z.enum([
  Object.values(algorithm)[0],
  ...Object.values(algorithm).slice(1),
]);
export type Algorithm = z.infer<typeof Algorithm>;

export const DPoPProofHeader = z
  .object({
    typ: z.string(),
    alg: z.string(),
    jwk: JWKKey.or(JWKKeyES),
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
