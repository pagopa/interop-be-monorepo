import { z } from "zod";

export const ClientAssertionAuditDetails = z.object({
  jwtId: z.string(),
  issuedAt: z.number(),
  algorithm: z.string(),
  keyId: z.string(),
  issuer: z.string(),
  subject: z.string(),
  audience: z.string(),
  expirationTime: z.number(),
});
export type ClientAssertionAuditDetails = z.infer<
  typeof ClientAssertionAuditDetails
>;

export const GeneratedTokenAuditDetails = z.object({
  jwtId: z.string(),
  correlationId: z.string(),
  issuedAt: z.number(),
  clientId: z.string(),
  organizationId: z.string(),
  agreementId: z.string(),
  eserviceId: z.string(),
  descriptorId: z.string(),
  purposeId: z.string(),
  purposeVersionId: z.string(),
  algorithm: z.string(),
  keyId: z.string(),
  audience: z.string(),
  subject: z.string(),
  notBefore: z.number(),
  expirationTime: z.number(),
  issuer: z.string(),
  clientAssertion: ClientAssertionAuditDetails,
});
export type GeneratedTokenAuditDetails = z.infer<
  typeof GeneratedTokenAuditDetails
>;
