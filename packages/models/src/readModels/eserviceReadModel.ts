/* 
 --- Technical NOTE ---
  ISSUE https://pagopa.atlassian.net/browse/IMN-315
  This model is used to guarantee compatibility with the old read model version,
  the old service read it using ISO string for all date fields, 
  while the new event version will use the Date type.
  After the complete services migration, this definition should be removed.
  Refer to the zod extend method for more implementation details https://zod.dev/?id=extend
*/

import { z } from "zod";
import { Descriptor, Document, EService, RiskAnalysis } from "../index.js";

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

export const EServiceLegacy = EService.extend({
  descriptors: z.array(DescriptorReadModel),
  createdAt: z.string().datetime(),
  riskAnalysis: z.array(RiskAnalysisReadModel),
});
export type EServiceReadModel = z.infer<typeof EServiceLegacy>;
