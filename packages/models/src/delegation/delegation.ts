import z from "zod";
import {
  DelegationContractId,
  DelegationId,
  EServiceId,
  TenantId,
  UserId,
} from "../brandedIds.js";

export const delegationKind = {
  delegatedConsumer: "DelegatedConsumer",
  delegatedProducer: "DelegatedProducer",
} as const;
export const DelegationKind = z.enum([
  Object.values(delegationKind)[0],
  ...Object.values(delegationKind).slice(1),
]);
export type DelegationKind = z.infer<typeof DelegationKind>;

export const delegationState = {
  waitingForApproval: "WaitingForApproval",
  active: "Active",
  rejected: "Rejected",
  revoked: "Revoked",
} as const;

export const DelegationState = z.enum([
  Object.values(delegationState)[0],
  ...Object.values(delegationState).slice(1),
]);
export type DelegationState = z.infer<typeof DelegationState>;

export const DelegationContractDocument = z.object({
  id: DelegationContractId,
  name: z.string(),
  prettyName: z.string(),
  contentType: z.string(),
  path: z.string(),
  createdAt: z.coerce.date(),
});
export type DelegationContractDocument = z.infer<
  typeof DelegationContractDocument
>;

export const DelegationStamp = z.object({
  who: UserId,
  when: z.coerce.date(),
});
export type DelegationStamp = z.infer<typeof DelegationStamp>;

export const DelegationStamps = z.object({
  submission: DelegationStamp,
  activation: DelegationStamp.optional(),
  rejection: DelegationStamp.optional(),
  revocation: DelegationStamp.optional(),
});
export type DelegationStamps = z.infer<typeof DelegationStamps>;

export const Delegation = z.object({
  id: DelegationId,
  delegatorId: TenantId,
  delegateId: TenantId,
  eserviceId: EServiceId,
  createdAt: z.coerce.date(),
  submittedAt: z.coerce.date(),
  approvedAt: z.coerce.date().optional(),
  rejectedAt: z.coerce.date().optional(),
  rejectionReason: z.string().optional(),
  revokedAt: z.coerce.date().optional(),
  state: DelegationState,
  kind: DelegationKind,
  activationContract: DelegationContractDocument.optional(),
  revocationContract: DelegationContractDocument.optional(),
  stamps: DelegationStamps,
});
export type Delegation = z.infer<typeof Delegation>;

// TODO: reorder the types or move the SQL types to a separate file
export const DelegationSQL = z.object({
  id: DelegationId,
  metadata_version: z.number(),
  delegator_id: TenantId,
  delegate_id: TenantId,
  eservice_id: EServiceId,
  created_at: z.coerce.date(),
  submitted_at: z.coerce.date(),
  approved_at: z.coerce.date().optional(),
  rejected_at: z.coerce.date().optional(),
  rejection_reason: z.string().optional(),
  revoked_at: z.coerce.date().optional(),
  state: DelegationState,
  kind: DelegationKind,
});
export type DelegationSQL = z.infer<typeof DelegationSQL>;

export const delegationStampKind = {
  submission: "submission",
  activation: "activation",
  rejection: "rejection",
  revocation: "revocation",
} as const;
export const DelegationStampKind = z.enum([
  Object.values(delegationStampKind)[0],
  ...Object.values(delegationStampKind).slice(1),
]);
export type DelegationStampKind = z.infer<typeof DelegationStampKind>;

export const DelegationStampSQL = z.object({
  delegation_id: DelegationId,
  metadata_version: z.number(),
  who: UserId,
  when: z.coerce.date(),
  kind: DelegationStampKind,
});
export type DelegationStampSQL = z.infer<typeof DelegationStampSQL>;

export const delegationContractKind = {
  activation: "activation",
  revocation: "revocation",
} as const;
export const DelegationContractKind = z.enum([
  Object.values(delegationContractKind)[0],
  ...Object.values(delegationContractKind).slice(1),
]);
export type DelegationContractKind = z.infer<typeof DelegationContractKind>;

export const DelegationContractDocumentSQL = z.object({
  id: DelegationContractId,
  delegation_id: DelegationId,
  metadata_version: z.number(),
  name: z.string(),
  content_type: z.string(),
  pretty_name: z.string(),
  path: z.string(),
  created_at: z.coerce.date(),
  kind: DelegationContractKind,
});
export type DelegationContractDocumentSQL = z.infer<
  typeof DelegationContractDocumentSQL
>;
