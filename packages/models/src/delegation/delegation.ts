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
