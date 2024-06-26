import { z } from "zod";

export const TokenGenerationConfig = z
  .object({
    INTERNAL_JWT_KID: z.string(),
    INTERNAL_JWT_SUBJECT: z.string(),
    INTERNAL_JWT_ISSUER: z.string(),
    INTERNAL_JWT_AUDIENCE: z.string().transform((v) => v.split(",")),
    INTERNAL_JWT_SECONDS_DURATION: z.coerce.number(),
    SESSION_JWT_KID: z.string(),
    SESSION_JWT_SUBJECT: z.string(),
    SESSION_JWT_ISSUER: z.string(),
    SESSION_JWT_AUDIENCE: z.string().transform((v) => v.split(",")),
    SESSION_JWT_SECONDS_DURATION: z.coerce.number(),
  })
  .transform((c) => ({
    kid: c.INTERNAL_JWT_KID,
    subject: c.INTERNAL_JWT_SUBJECT,
    issuer: c.INTERNAL_JWT_ISSUER,
    audience: c.INTERNAL_JWT_AUDIENCE,
    secondsDuration: c.INTERNAL_JWT_SECONDS_DURATION,
    sessionKid: c.SESSION_JWT_KID,
    sessionSubject: c.SESSION_JWT_SUBJECT,
    sessionIssuer: c.SESSION_JWT_ISSUER,
    sessionAudience: c.SESSION_JWT_AUDIENCE,
    sessionSecondsDuration: c.SESSION_JWT_SECONDS_DURATION,
  }));

export type TokenGenerationConfig = z.infer<typeof TokenGenerationConfig>;

export const tokenGenerationConfig: () => TokenGenerationConfig = () =>
  TokenGenerationConfig.parse(process.env);
