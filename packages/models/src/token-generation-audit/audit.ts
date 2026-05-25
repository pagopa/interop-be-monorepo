import { z } from "zod";
import {
  AgreementId,
  ClientId,
  DescriptorId,
  EServiceId,
  InteractionId,
  PurposeId,
  PurposeVersionId,
  TenantId,
} from "../brandedIds.js";
import { JWKKeyRS256, JWKKeyES256 } from "../authorization/key.js";
import { InteractionState } from "../token-generation-readmodel/interactions-entry.js";

export const ClientAssertionAuditDetails = z.object({
  jwtId: z.string(),
  issuedAt: z.number(),
  algorithm: z.string(),
  keyId: z.string(),
  issuer: z.string(),
  subject: ClientId,
  audience: z.string(),
  expirationTime: z.number(),
});
export type ClientAssertionAuditDetails = z.infer<
  typeof ClientAssertionAuditDetails
>;

export const DPoPAuditDetails = z.object({
  typ: z.string(),
  alg: z.string(),
  jwk: JWKKeyRS256.or(JWKKeyES256),
  htm: z.string(),
  htu: z.string(),
  iat: z.number().int().min(0),
  jti: z.string(),
});
export type DPoPAuditDetails = z.infer<typeof DPoPAuditDetails>;

export const InteractionAuditDetails = z.object({
  interactionId: InteractionId,
  state: InteractionState,
  startInteractionTokenIssuedAt: z.string().datetime().optional(),
  callbackInvocationTokenIssuedAt: z.string().datetime().optional(),
  confirmationTokenIssuedAt: z.string().datetime().optional(),
});
export type InteractionAuditDetails = z.infer<typeof InteractionAuditDetails>;

export const GeneratedTokenAuditDetails = z.object({
  jwtId: z.string(),
  correlationId: z.string(),
  issuedAt: z.number(),
  clientId: ClientId,
  organizationId: TenantId,
  agreementId: AgreementId,
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  purposeId: PurposeId,
  purposeVersionId: PurposeVersionId,
  algorithm: z.string(),
  keyId: z.string(),
  audience: z.string(),
  subject: z.string(),
  notBefore: z.number(),
  expirationTime: z.number(),
  issuer: z.string(),
  clientAssertion: ClientAssertionAuditDetails,
  dpop: DPoPAuditDetails.optional(),
  interaction: InteractionAuditDetails.optional(),
});
export type GeneratedTokenAuditDetails = z.infer<
  typeof GeneratedTokenAuditDetails
>;
