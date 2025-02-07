import { z } from "zod";
import {
  DelegationId,
  EServiceId,
  PurposeId,
  PurposeVersionDocumentId,
  PurposeVersionId,
  TenantId,
} from "../brandedIds.js";
import { PurposeRiskAnalysisForm } from "../risk-analysis/riskAnalysis.js";

export const purposeVersionState = {
  draft: "Draft",
  active: "Active",
  suspended: "Suspended",
  archived: "Archived",
  waitingForApproval: "WaitingForApproval",
  rejected: "Rejected",
} as const;
export const PurposeVersionState = z.enum([
  Object.values(purposeVersionState)[0],
  ...Object.values(purposeVersionState).slice(1),
]);
export type PurposeVersionState = z.infer<typeof PurposeVersionState>;

export const PurposeVersionDocument = z.object({
  id: PurposeVersionDocumentId,
  contentType: z.string(),
  path: z.string(),
  createdAt: z.coerce.date(),
});
export type PurposeVersionDocument = z.infer<typeof PurposeVersionDocument>;

export const PurposeVersion = z.object({
  id: PurposeVersionId,
  state: PurposeVersionState,
  riskAnalysis: PurposeVersionDocument.optional(),
  dailyCalls: z.number(),
  rejectionReason: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  firstActivationAt: z.coerce.date().optional(),
  suspendedAt: z.coerce.date().optional(),
});
export type PurposeVersion = z.infer<typeof PurposeVersion>;

export const Purpose = z.object({
  id: PurposeId,
  eserviceId: EServiceId,
  consumerId: TenantId,
  delegationId: DelegationId.optional(),
  versions: z.array(PurposeVersion),
  suspendedByConsumer: z.boolean().optional(),
  suspendedByProducer: z.boolean().optional(),
  title: z.string(),
  description: z.string(),
  riskAnalysisForm: PurposeRiskAnalysisForm.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  isFreeOfCharge: z.boolean(),
  freeOfChargeReason: z.string().optional(),
});
export type Purpose = z.infer<typeof Purpose>;

export const PurposeSQL = z.object({
  id: PurposeId,
  metadata_version: z.number(),
  eservice_id: EServiceId,
  consumer_id: TenantId,
  delegation_id: DelegationId,
  suspended_by_consumer: z.boolean().optional(),
  suspended_by_producer: z.boolean().optional(),
  title: z.string(),
  description: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().optional(),
  is_free_of_charge: z.boolean(),
  free_of_charge_reason: z.string().optional(),
});
export type PurposeSQL = z.infer<typeof PurposeSQL>;

export const PurposeVersionSQL = z.object({
  id: PurposeVersionId,
  purpose_id: PurposeId,
  metadata_version: z.number(),
  state: PurposeVersionState,
  daily_calls: z.number(),
  rejection_reason: z.string().optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().optional(),
  first_activation_at: z.coerce.date().optional(),
  suspended_at: z.coerce.date().optional(),
});
export type PurposeVersionSQL = z.infer<typeof PurposeVersionSQL>;

export const PurposeVersionDocumentSQL = z.object({
  purpose_id: PurposeId,
  metadata_version: z.number(),
  purpose_version_id: PurposeVersionId,
  id: PurposeVersionDocumentId,
  content_type: z.string(),
  path: z.string(),
  created_at: z.coerce.date(),
});
export type PurposeVersionDocumentSQL = z.infer<
  typeof PurposeVersionDocumentSQL
>;
