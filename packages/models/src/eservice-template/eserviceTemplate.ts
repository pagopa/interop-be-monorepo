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

  // The following fields are values to be set in all the e-service instances of this template, not editable by the user
  description: z.string().optional(),
  interface: Document.optional(),
  docs: z.array(Document),
  voucherLifespan: z.number().int(),
  attributes: EServiceAttributes,

  // The following fields are default values that will be set in all the e-service instances in case the user does not provide a value
  dailyCallsPerConsumer: z.number().int().optional(),
  dailyCallsTotal: z.number().int().optional(),
  agreementApprovalPolicy: AgreementApprovalPolicy.optional(),
});
export type EServiceTemplateVersion = z.infer<typeof EServiceTemplateVersion>;

export const EServiceTemplate = z.object({
  id: EServiceTemplateId,
  creatorId: TenantId,
  intendedTarget: z.string(),
  versions: z.array(EServiceTemplateVersion),
  createdAt: z.coerce.date(),

  // The following fields are values to be set in all the e-service instances of this template, not editable by the user
  name: z.string(),
  description: z.string(),
  technology: Technology,
  riskAnalysis: z.array(RiskAnalysis),
  mode: EServiceMode,

  // This field acts as a default value for all the e-service instances created from this template, in case not set by the user
  isSignalHubEnabled: z.boolean().optional(),
});
export type EServiceTemplate = z.infer<typeof EServiceTemplate>;
