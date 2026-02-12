import { z } from "zod";

export const IntegrityRest02SignatureConfig = z
  .object({
    INTEGRITY_REST_JWT_KID: z.string(),
    INTEGRITY_REST_JWT_SUBJECT: z.string(),
    INTEGRITY_REST_JWT_ISSUER: z.string(),
    INTEGRITY_REST_JWT_AUDIENCE: z.string().transform((v) => v.split(",")),
    INTEGRITY_REST_JWT_SECONDS_DURATION: z.coerce.number(),
  })
  .transform((c) => ({
    integrityRestSignatureKid: c.INTEGRITY_REST_JWT_KID,
    integrityRestSignatureSubject: c.INTEGRITY_REST_JWT_SUBJECT,
    integrityRestSignatureIssuer: c.INTEGRITY_REST_JWT_ISSUER,
    integrityRestSignatureAudience: c.INTEGRITY_REST_JWT_AUDIENCE,
    integrityRestSignatureSecondsDuration:
      c.INTEGRITY_REST_JWT_SECONDS_DURATION,
  }));

export type IntegrityRest02SignatureConfig = z.infer<
  typeof IntegrityRest02SignatureConfig
>;
