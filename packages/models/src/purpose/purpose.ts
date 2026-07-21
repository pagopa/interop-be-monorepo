import { z } from "zod";

import {
  DelegationId,
  EServiceId,
  PurposeId,
  PurposeTemplateId,
  PurposeVersionDocumentId,
  PurposeVersionId,
  TenantId,
  UserId,
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

export const riskAnalysisReviewMode = {
  reviewerWritesReviewerSigns: "ReviewerWritesReviewerSigns",
  adminWritesReviewerSigns: "AdminWritesReviewerSigns",
} as const;
export const RiskAnalysisReviewMode = z.enum([
  Object.values(riskAnalysisReviewMode)[0],
  ...Object.values(riskAnalysisReviewMode).slice(1),
]);
export type RiskAnalysisReviewMode = z.infer<typeof RiskAnalysisReviewMode>;

export const riskAnalysisSigningState = {
  draft: "Draft",
  assigned: "Assigned",
  submitted: "Submitted",
  signed: "Signed",
  rejected: "Rejected",
} as const;
export const RiskAnalysisSigningState = z.enum([
  Object.values(riskAnalysisSigningState)[0],
  ...Object.values(riskAnalysisSigningState).slice(1),
]);
export type RiskAnalysisSigningState = z.infer<typeof RiskAnalysisSigningState>;

export const PurposeVersionDocument = z.object({
  id: PurposeVersionDocumentId,
  contentType: z.string(),
  path: z.string(),
  createdAt: z.coerce.date(),
});
export type PurposeVersionDocument = z.infer<typeof PurposeVersionDocument>;

export const PurposeVersionSignedDocument = z.object({
  id: PurposeVersionDocumentId,
  contentType: z.string(),
  path: z.string(),
  createdAt: z.coerce.date(),
  signedAt: z.coerce.date().optional(),
});
export type PurposeVersionSignedDocument = z.infer<
  typeof PurposeVersionSignedDocument
>;

export const PurposeVersionStamp = z.object({
  who: UserId,
  when: z.coerce.date(),
});
export type PurposeVersionStamp = z.infer<typeof PurposeVersionStamp>;

export const PurposeVersionStamps = z.object({
  creation: PurposeVersionStamp,
});
export type PurposeVersionStamps = z.infer<typeof PurposeVersionStamps>;

export const PurposeVersionStampKind = PurposeVersionStamps.keyof();
export type PurposeVersionStampKind = z.infer<typeof PurposeVersionStampKind>;

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
  stamps: PurposeVersionStamps.optional(),
  signedContract: PurposeVersionSignedDocument.optional(),
});
export type PurposeVersion = z.infer<typeof PurposeVersion>;

export const ReviewerWorkflow = z.object({
  reviewMode: RiskAnalysisReviewMode,
  reviewerIds: z.array(UserId),
  signingState: RiskAnalysisSigningState,
  signedBy: UserId.optional(),
  rejectionReason: z.string().optional(),
  sentToReviewerAt: z.coerce.date().optional(),
});
export type ReviewerWorkflow = z.infer<typeof ReviewerWorkflow>;

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
  purposeTemplateId: PurposeTemplateId.optional(),
  reviewerWorkflow: ReviewerWorkflow.optional(),
});
export type Purpose = z.infer<typeof Purpose>;
