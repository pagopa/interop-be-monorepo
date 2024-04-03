/*
  This model is required for retro-compatibility with the read model in production:
  the Scala services read/write ISO strings for all date fields.

  After all services will be migrated to TS, we should remove this model
  and the corresponding adapters, as tracked in https://pagopa.atlassian.net/browse/IMN-367
*/

import { z } from "zod";
import { Descriptor, Document, EService } from "../eservice/eservice.js";
import { RiskAnalysis } from "../risk-analysis/riskAnalysis.js";

export const DocumentReadModel = Document.extend({
  uploadDate: z.string().datetime(),
});
export type DocumentReadModel = z.infer<typeof DocumentReadModel>;

export const RiskAnalysisReadModel = RiskAnalysis.extend({
  createdAt: z.string().datetime(),
});
export type RiskAnalysisReadModel = z.infer<typeof RiskAnalysisReadModel>;

export const DescriptorReadModel = Descriptor.extend({
  interface: DocumentReadModel.optional(),
  docs: z.array(DocumentReadModel),
  createdAt: z.string().datetime(),
  publishedAt: z.string().datetime().optional(),
  suspendedAt: z.string().datetime().optional(),
  deprecatedAt: z.string().datetime().optional(),
  archivedAt: z.string().datetime().optional(),
});
export type DescriptorReadModel = z.infer<typeof DescriptorReadModel>;

export const EServiceReadModel = EService.extend({
  descriptors: z.array(DescriptorReadModel),
  createdAt: z.string().datetime(),
  riskAnalysis: z.array(RiskAnalysisReadModel),
});
export type EServiceReadModel = z.infer<typeof EServiceReadModel>;
