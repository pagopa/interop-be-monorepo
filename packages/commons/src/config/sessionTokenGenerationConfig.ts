import { z } from "zod";

export const SessionTokenGenerationConfig = z
  .object({
    GENERATED_JWT_KID: z.string(),
    GENERATED_JWT_ISSUER: z.string(),
    GENERATED_JWT_AUDIENCE: z.string().transform((v) => v.split(",")),
    GENERATED_JWT_SECONDS_DURATION: z.coerce.number(),
  })
  .transform((c) => ({
    generatedKid: c.GENERATED_JWT_KID,
    generatedIssuer: c.GENERATED_JWT_ISSUER,
    generatedAudience: c.GENERATED_JWT_AUDIENCE,
    generatedSecondsDuration: c.GENERATED_JWT_SECONDS_DURATION,
  }));

export type SessionTokenGenerationConfig = z.infer<
  typeof SessionTokenGenerationConfig
>;
