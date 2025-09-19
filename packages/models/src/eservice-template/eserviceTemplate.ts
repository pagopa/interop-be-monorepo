import z from "zod";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  TenantId,
} from "../brandedIds.js";
import {
  Document,
  AgreementApprovalPolicy,
  EServiceAttributes,
  Technology,
  EServiceMode,
} from "../eservice/eservice.js";
import { RiskAnalysis } from "../risk-analysis/riskAnalysis.js";
import { TenantKind } from "../tenant/tenant.js";

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

export const EServiceTemplateVersion = z.object({
  id: EServiceTemplateVersionId,
  version: z.number(),
  state: EServiceTemplateVersionState,
  createdAt: z.coerce.date(),
  publishedAt: z.coerce.date().optional(),
  suspendedAt: z.coerce.date().optional(),
  deprecatedAt: z.coerce.date().optional(),

  // Values to be set in all e-service descriptor instances created from this template, not editable by the user
  description: z.string().optional(),
  interface: Document.optional(),
  docs: z.array(Document),
  voucherLifespan: z.number().int(),
  attributes: EServiceAttributes,
  // Default values to be set in all e-service descriptor instances created from this template, unless the user provides a custom value
  dailyCallsPerConsumer: z.number().int().optional(),
  dailyCallsTotal: z.number().int().optional(),
  agreementApprovalPolicy: AgreementApprovalPolicy.optional(),
});
export type EServiceTemplateVersion = z.infer<typeof EServiceTemplateVersion>;

export const EServiceTemplateRiskAnalysis = RiskAnalysis.and(
  z.object({ tenantKind: TenantKind })
);
export type EServiceTemplateRiskAnalysis = z.infer<
  typeof EServiceTemplateRiskAnalysis
>;

export const EServiceTemplate = z.object({
  id: EServiceTemplateId,
  creatorId: TenantId,
  intendedTarget: z.string(),
  versions: z.array(EServiceTemplateVersion),
  createdAt: z.coerce.date(),

  // Values to be set in all e-service instances created from this template, not editable by the user
  name: z.string(),
  description: z.string(),
  technology: Technology,
  riskAnalysis: z.array(EServiceTemplateRiskAnalysis),
  mode: EServiceMode,
  personalData: z.boolean().optional(),

  // Default values to be set in all e-service instances created from this template, unless the user provides a custom value
  isSignalHubEnabled: z.boolean().optional(),
});
export type EServiceTemplate = z.infer<typeof EServiceTemplate>;
