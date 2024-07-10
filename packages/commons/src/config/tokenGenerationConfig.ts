import { z } from "zod";

export const TokenGenerationConfig = z
  .object({
    INTERNAL_JWT_KID: z.string(),
    INTERNAL_JWT_SUBJECT: z.string(),
    INTERNAL_JWT_ISSUER: z.string(),
    INTERNAL_JWT_AUDIENCE: z.string().transform((v) => v.split(",")),
    INTERNAL_JWT_SECONDS_DURATION: z.coerce.number(),
    GENERATED_JWT_KID: z.string(),
    GENERATED_JWT_SUBJECT: z.string(),
    GENERATED_JWT_ISSUER: z.string(),
    GENERATED_JWT_AUDIENCE: z.string().transform((v) => v.split(",")),
    GENERATED_JWT_SECONDS_DURATION: z.coerce.number(),
  })
  .transform((c) => ({
    kid: c.INTERNAL_JWT_KID,
    subject: c.INTERNAL_JWT_SUBJECT,
    issuer: c.INTERNAL_JWT_ISSUER,
    audience: c.INTERNAL_JWT_AUDIENCE,
    secondsDuration: c.INTERNAL_JWT_SECONDS_DURATION,
    generatedKid: c.GENERATED_JWT_KID,
    generatedSubject: c.GENERATED_JWT_SUBJECT,
    generatedIssuer: c.GENERATED_JWT_ISSUER,
    generatedAudience: c.GENERATED_JWT_AUDIENCE,
    generatedSecondsDuration: c.GENERATED_JWT_SECONDS_DURATION,
  }));

export type TokenGenerationConfig = z.infer<typeof TokenGenerationConfig>;
