import { z } from "zod";
import { ClientId, PurposeId } from "../brandedIds.js";

export const ClientAssertionDigest = z
  .object({
    alg: z.string(),
    value: z.string(),
  })
  .strict();
export type ClientAssertionDigest = z.infer<typeof ClientAssertionDigest>;

export const ClientAssertionHeader = z
  .object({
    kid: z.string(),
    alg: z.string(),
    typ: z.string().optional(),
  })
  .strict();
export type ClientAssertionHeader = z.infer<typeof ClientAssertionHeader>;

export const ClientAssertionPayload = z
  .object({
    sub: ClientId,
    jti: z.string(),
    iat: z.number(),
    iss: z.string(),
    aud: z.array(z.string()).or(z.string()),
    exp: z.number(),
    digest: ClientAssertionDigest.nullish(),
    purposeId: PurposeId.optional(),
    // Note: these claims are not part of the spec. Added to provide backward compatibility for organizations that already send them
    client_id: z.string().optional(),
    nbf: z.number().optional(),
    nbt: z.any().nullish(),
  })
  .strict();
export type ClientAssertionPayload = z.infer<typeof ClientAssertionPayload>;

export const ClientAssertion = z
  .object({
    header: ClientAssertionHeader,
    payload: ClientAssertionPayload,
  })
  .strict();
export type ClientAssertion = z.infer<typeof ClientAssertion>;
