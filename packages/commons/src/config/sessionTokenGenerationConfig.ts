import { z } from "zod";

export const SessionTokenGenerationConfig = z
  .object({
    GENERATED_JWT_KID: z.string(),
    GENERATED_JWT_ISSUER: z.string(),
    GENERATED_JWT_AUDIENCE: z.string().transform((v) => v.split(",")),
    GENERATED_JWT_SECONDS_DURATION: z.coerce.number(),
  })
  .transform((c) => ({
    sessionKid: c.GENERATED_JWT_KID,
    sessionIssuer: c.GENERATED_JWT_ISSUER,
    sessionAudience: c.GENERATED_JWT_AUDIENCE,
    sessionSecondsDuration: c.GENERATED_JWT_SECONDS_DURATION,
  }));

export type SessionTokenGenerationConfig = z.infer<
  typeof SessionTokenGenerationConfig
>;
