import { z } from "zod";
import {
  DescriptorId,
  EServiceId,
  PurposeTemplateId,
  TenantId,
} from "../brandedIds.js";
import { RiskAnalysisFormTemplate } from "../risk-analysis/riskAnalysis.js";
import { TenantKind } from "../tenant/tenant.js";

export const purposeTemplateState = {
  draft: "Draft",
  active: "Active",
  suspended: "Suspended",
  archived: "Archived",
} as const;
export const PurposeTemplateState = z.enum([
  Object.values(purposeTemplateState)[0],
  ...Object.values(purposeTemplateState).slice(1),
]);
export type PurposeTemplateState = z.infer<typeof PurposeTemplateState>;

export const EServiceDescriptorPurposeTemplate = z.object({
  purposeTemplateId: PurposeTemplateId,
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  createdAt: z.coerce.date(),
});
export type EServiceDescriptorVersionPurposeTemplate = z.infer<
  typeof EServiceDescriptorPurposeTemplate
>;

export const PurposeTemplate = z.object({
  id: PurposeTemplateId,
  targetDescription: z.string(),
  targetTenantKind: TenantKind,
  creatorId: TenantId,
  state: PurposeTemplateState,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  purposeTitle: z.string(),
  purposeDescription: z.string(),
  purposeRiskAnalysisForm: RiskAnalysisFormTemplate.optional(),
  purposeIsFreeOfCharge: z.boolean(),
  purposeFreeOfChargeReason: z.string().optional(),
  purposeDailyCalls: z.number().optional(),
});
export type PurposeTemplate = z.infer<typeof PurposeTemplate>;
