import { z } from "zod";

export const TokenGenerationConfig = z
  .object({
    INTERNAL_JWT_KID: z.string(),
    INTERNAL_JWT_SUBJECT: z.string(),
    INTERNAL_JWT_ISSUER: z.string(),
    INTERNAL_JWT_AUDIENCE: z.string().transform((v) => v.split(",")),
    INTERNAL_JWT_SECONDS_DURATION: z.coerce.number(),
  })
  .transform((c) => ({
    internalKid: c.INTERNAL_JWT_KID,
    internalSubject: c.INTERNAL_JWT_SUBJECT,
    internalIssuer: c.INTERNAL_JWT_ISSUER,
    internalAudience: c.INTERNAL_JWT_AUDIENCE,
    internalSecondsDuration: c.INTERNAL_JWT_SECONDS_DURATION,
  }));

export type TokenGenerationConfig = z.infer<typeof TokenGenerationConfig>;
