import { z } from "zod";
import { JWKKeyRS256, JWKKeyES256 } from "../authorization/key.js";

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
    jwk: JWKKeyRS256.or(JWKKeyES256),
  })
  .strict();
export type DPoPProofHeader = z.infer<typeof DPoPProofHeader>;

export const DPoPProofPayload = z
  .object({
    htm: z.string(),
    htu: z.string(),
    iat: z.number(),
    jti: z.string(),
    ath: z.string().optional(),
  })
  .strict();
export type DPoPProofPayload = z.infer<typeof DPoPProofPayload>;

export const DPoPProofResourcePayload = DPoPProofPayload.extend({
  ath: z.string(),
});
export type DPoPProofResourcePayload = z.infer<typeof DPoPProofResourcePayload>;

export const DPoPProof = z
  .object({
    header: DPoPProofHeader,
    payload: DPoPProofPayload,
  })
  .strict();
export type DPoPProof = z.infer<typeof DPoPProof>;

export const DPoPProofResource = z
  .object({
    header: DPoPProofHeader,
    payload: DPoPProofResourcePayload,
  })
  .strict();
export type DPoPProofResource = z.infer<typeof DPoPProofResource>;
