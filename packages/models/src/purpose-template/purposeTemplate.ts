import { z } from "zod";
import {
  DescriptorId,
  EServiceId,
  PurposeTemplateId,
  TenantId,
} from "../brandedIds.js";
import { RiskAnalysisFormTemplate } from "../risk-analysis/riskAnalysis.js";

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

export const PurposeTemplate = z.object({
  id: PurposeTemplateId,
  name: z.string(),
  target: z.string(),
  creatorId: TenantId,
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  state: PurposeTemplateState,
  title: z.string(),
  description: z.string(),
  riskAnalysisForm: RiskAnalysisFormTemplate.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  isFreeOfCharge: z.boolean(),
  freeOfChargeReason: z.string().optional(),
  dailyCalls: z.number().optional(),
});
