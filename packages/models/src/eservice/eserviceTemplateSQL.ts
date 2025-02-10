import { z } from "zod";
import { AttributeKind } from "../attribute/attribute.js";
import {
  AttributeId,
  EServiceDocumentId,
  RiskAnalysisFormId,
  RiskAnalysisId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  TenantId,
} from "../brandedIds.js";
import {
  AgreementApprovalPolicy,
  EServiceMode,
  Technology,
} from "./eservice.js";

export const EServiceTemplateId = z.string().uuid().brand("EServiceTemplateId");
export type EServiceTemplateId = z.infer<typeof EServiceTemplateId>;

// TODO: remove and import from brandedIds
export const EServiceTemplateVersionId = z
  .string()
  .uuid()
  .brand("EServiceTemplateVersionId");
export type EServiceTemplateVersionId = z.infer<
  typeof EServiceTemplateVersionId
>;

// TODO: remove and import from brandedIds
export const eserviceTemplateVersionState = {
  draft: "Draft",
  published: "Published",
  suspended: "Suspended",
  deprecated: "Deprecated",
} as const;
export const EServiceTemplateVersionState = z.enum([
  Object.values(eserviceTemplateVersionState)[0],
  ...Object.values(eserviceTemplateVersionState).slice(1),
]);
export type EServiceTemplateVersionState = z.infer<
  typeof EServiceTemplateVersionState
>;

// TODO: reuse DocumentKind from eservice.js
export const eServiceTemplateVersionDocumentKind = {
  descriptorInterface: "INTERFACE",
  descriptorDocument: "DOCUMENT",
} as const;
export const EServiceTemplateVersionDocumentKind = z.enum([
  Object.values(eServiceTemplateVersionDocumentKind)[0],
  ...Object.values(eServiceTemplateVersionDocumentKind).slice(1),
]);
export type EServiceTemplateVersionDocumentKind = z.infer<
  typeof EServiceTemplateVersionDocumentKind
>;

export const EServiceTemplateVersionSQL = z.object({
  id: EServiceTemplateVersionId,
  eservice_template_id: EServiceTemplateId,
  metadata_version: z.number(),
  version: z.string(),
  description: z.string().optional(),
  state: EServiceTemplateVersionState,
  voucher_lifespan: z.number().int(),
  daily_calls_per_consumer: z.number().int().optional(),
  daily_calls_total: z.number().int().optional(),
  agreement_approval_policy: AgreementApprovalPolicy.optional(),
  created_at: z.coerce.date(),
  published_at: z.coerce.date().optional().nullable(),
  suspended_at: z.coerce.date().optional().nullable(),
  deprecated_at: z.coerce.date().optional().nullable(),
});
export type EServiceTemplateVersionSQL = z.infer<
  typeof EServiceTemplateVersionSQL
>;

export const EServiceTemplateVersionDocumentSQL = z.object({
  id: EServiceDocumentId,
  eservice_template_id: EServiceTemplateId,
  metadata_version: z.number(),
  eservice_template_version_id: EServiceTemplateVersionId,
  name: z.string(),
  content_type: z.string(),
  pretty_name: z.string(),
  path: z.string(),
  checksum: z.string(),
  upload_date: z.coerce.date(),
  kind: EServiceTemplateVersionDocumentKind,
});
export type EServiceTemplateVersionDocumentSQL = z.infer<
  typeof EServiceTemplateVersionDocumentSQL
>;

export const EServiceTemplateVersionAttributeSQL = z.object({
  attribute_id: AttributeId,
  eservice_template_id: EServiceTemplateId,
  metadata_version: z.number(),
  eservice_template_version_id: EServiceTemplateVersionId,
  explicit_attribute_verification: z.boolean(),
  kind: AttributeKind,
  group_id: z.number(),
});
export type EServiceTemplateVersionAttributeSQL = z.infer<
  typeof EServiceTemplateVersionAttributeSQL
>;

// TODO: PUT in riskAnalysis.ts
export const EServiceTemplateRiskAnalysisSQL = z.object({
  id: RiskAnalysisId,
  eservice_template_id: EServiceTemplateId,
  metadata_version: z.number(),
  name: z.string().optional(),
  created_at: z.coerce.date(),
  risk_analysis_form_id: RiskAnalysisFormId,
  risk_analysis_form_version: z.string(),
});
export type EServiceTemplateRiskAnalysisSQL = z.infer<
  typeof EServiceTemplateRiskAnalysisSQL
>;

// TODO AND CHECK remove and import from riskAnalysis.ts
export const riskAnalysisAnswerKind = {
  single: "SINGLE",
  multi: "MULTI",
} as const;
export const RiskAnalysisAnswerKind = z.enum([
  Object.values(riskAnalysisAnswerKind)[0],
  ...Object.values(riskAnalysisAnswerKind).slice(1),
]);
export type RiskAnalysisAnswerKind = z.infer<typeof RiskAnalysisAnswerKind>;

// TODO: PUT in riskAnalysis.ts
export const EServiceTemplateRiskAnalysisAnswerSQL = z.object({
  id: RiskAnalysisSingleAnswerId.or(RiskAnalysisMultiAnswerId),
  eservice_template_id: EServiceTemplateId,
  metadata_version: z.number(),
  risk_analysis_form_id: RiskAnalysisFormId,
  kind: RiskAnalysisAnswerKind,
  key: z.string(),
  value: z.array(z.string()),
});
export type EServiceTemplateRiskAnalysisAnswerSQL = z.infer<
  typeof EServiceTemplateRiskAnalysisAnswerSQL
>;

export const EServiceTemplateSQL = z.object({
  id: EServiceTemplateId,
  metadata_version: z.number(),
  creator_id: TenantId,
  name: z.string(),
  audience_description: z.string(),
  eservice_description: z.string(),
  technology: Technology,
  created_at: z.coerce.date(),
  mode: EServiceMode,
  is_signal_hub_enabled: z.boolean().optional(),
});
export type EServiceTemplateSQL = z.infer<typeof EServiceTemplateSQL>;
