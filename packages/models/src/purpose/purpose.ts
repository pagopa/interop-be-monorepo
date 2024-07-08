import { z } from "zod";
import {
  EServiceId,
  PurposeId,
  PurposeVersionDocumentId,
  PurposeVersionId,
  TenantId,
} from "../brandedIds.js";
import { PurposeRiskAnalysisForm } from "../risk-analysis/riskAnalysis.js";
import { EServiceMode } from "../eservice/eservice.js";

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
  expectedApprovalDate: z.coerce.date().optional(),
  firstActivationAt: z.coerce.date().optional(),
  suspendedAt: z.coerce.date().optional(),
});
export type PurposeVersion = z.infer<typeof PurposeVersion>;

export const Purpose = z.object({
  id: PurposeId,
  eserviceId: EServiceId,
  consumerId: TenantId,
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

export const ownership = {
  CONSUMER: "CONSUMER",
  PRODUCER: "PRODUCER",
  SELF_CONSUMER: "SELF_CONSUMER",
} as const;
export const Ownership = z.enum([
  Object.values(ownership)[0],
  ...Object.values(ownership).slice(1),
]);
export type Ownership = z.infer<typeof Ownership>;

export const PurposeDocumentEServiceInfo = z.object({
  name: z.string(),
  mode: EServiceMode,
  producerName: z.string(),
  producerOrigin: z.string(),
  producerIPACode: z.string(),
  consumerName: z.string(),
  consumerOrigin: z.string(),
  consumerIPACode: z.string(),
});
export type PurposeDocumentEServiceInfo = z.infer<
  typeof PurposeDocumentEServiceInfo
>;

export type RiskAnalysisDocumentPDFPayload = {
  dailyCalls: string;
  answers: string;
  eServiceName: string;
  producerText: string;
  consumerText: string;
  freeOfCharge: string;
  freeOfChargeReason: string;
  date: string;
  eServiceMode: string;
};
