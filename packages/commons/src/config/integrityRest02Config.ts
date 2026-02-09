import { z } from "zod";

export const IntegrityRest02TokenConfig = z
  .object({
    INTEGRITY_REST_JWT_KID: z.string(),
    INTEGRITY_REST_JWT_SUBJECT: z.string(),
    INTEGRITY_REST_JWT_ISSUER: z.string(),
    INTEGRITY_REST_JWT_AUDIENCE: z.string().transform((v) => v.split(",")),
    INTEGRITY_REST_JWT_SECONDS_DURATION: z.coerce.number(),
  })
  .transform((c) => ({
    integrityRestKid: c.INTEGRITY_REST_JWT_KID,
    integrityRestSubject: c.INTEGRITY_REST_JWT_SUBJECT,
    integrityRestIssuer: c.INTEGRITY_REST_JWT_ISSUER,
    integrityRestAudience: c.INTEGRITY_REST_JWT_AUDIENCE,
    integrityRestSecondsDuration: c.INTEGRITY_REST_JWT_SECONDS_DURATION,
  }));

export type IntegrityRest02TokenConfig = z.infer<
  typeof IntegrityRest02TokenConfig
>;
