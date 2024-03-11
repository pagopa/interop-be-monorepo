/* 
 --- Technical NOTE ---
  ISSUE https://pagopa.atlassian.net/browse/IMN-315
  This model is used guarantee the compatibility with old read model version,
  the old service read it using ISO string for all date fields, 
  meanwhile the new event version will use date type.
  After the complete services update this definition should be removed.
*/

import { z } from "zod";
import {
  AgreementApprovalPolicy,
  DescriptorId,
  DescriptorState,
  EServiceAttributes,
  EServiceDocumentId,
  EServiceId,
  EServiceMode,
  RiskAnalysisForm,
  RiskAnalysisId,
  Technology,
  TenantId,
} from "../index.js";

export const DocumentLegacy = z.object({
  id: EServiceDocumentId,
  name: z.string(),
  contentType: z.string(),
  prettyName: z.string(),
  path: z.string(),
  checksum: z.string(),
  uploadDate: z.string().datetime(),
});
export type DocumentLegacy = z.infer<typeof DocumentLegacy>;

export const DescriptorLegacy = z.object({
  id: DescriptorId,
  version: z.string(),
  description: z.string().optional(),
  interface: DocumentLegacy.optional(),
  docs: z.array(DocumentLegacy),
  state: DescriptorState,
  audience: z.array(z.string()),
  voucherLifespan: z.number().int(),
  dailyCallsPerConsumer: z.number().int(),
  dailyCallsTotal: z.number().int(),
  agreementApprovalPolicy: AgreementApprovalPolicy.optional(),
  createdAt: z.string().datetime(),
  serverUrls: z.array(z.string()),
  publishedAt: z.string().datetime().optional(),
  suspendedAt: z.string().datetime().optional(),
  deprecatedAt: z.string().datetime().optional(),
  archivedAt: z.string().datetime().optional(),
  attributes: EServiceAttributes,
});
export type DescriptorLegacy = z.infer<typeof DescriptorLegacy>;

export const RiskAnalysisLegacy = z.object({
  id: RiskAnalysisId,
  name: z.string(),
  riskAnalysisForm: RiskAnalysisForm,
  createdAt: z.string().datetime(),
});
export type RiskAnalysisLegacy = z.infer<typeof RiskAnalysisLegacy>;

export const EServiceLegacy = z.object({
  id: EServiceId,
  producerId: TenantId,
  name: z.string(),
  description: z.string(),
  technology: Technology,
  attributes: EServiceAttributes.optional(),
  descriptors: z.array(DescriptorLegacy),
  createdAt: z.string().datetime(),
  riskAnalysis: z.array(RiskAnalysisLegacy),
  mode: EServiceMode,
});
export type EServiceLegacy = z.infer<typeof EServiceLegacy>;
