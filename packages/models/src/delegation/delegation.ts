import z from "zod";
import { DelegationId, EServiceId, TenantId } from "../brandedIds.js";

export const delegationKind = {
  LeadOrganization: "LeadOrganization",
};
export const DelegationKind = z.enum([
  Object.values(delegationKind)[0],
  ...Object.values(delegationKind).slice(1),
]);
export type DelegationKind = z.infer<typeof DelegationKind>;

export const delegationState = {
  Submitted: "Submitted",
  Approved: "Approved",
  Rejected: "Rejected",
  Revoked: "Revoked",
};

export const DelegationState = z.enum([
  Object.values(delegationState)[0],
  ...Object.values(delegationState).slice(1),
]);
export type DelegationState = z.infer<typeof DelegationState>;

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
});
export type Delegation = z.infer<typeof Delegation>;
