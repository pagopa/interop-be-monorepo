/*
  This model is required for retro-compatibility with the read model in production:
  the Scala services read/write ISO strings for all date fields.

  After all services will be migrated to TS, we should remove this model
  and the corresponding adapters, as tracked in https://pagopa.atlassian.net/browse/IMN-367
*/

import { z } from "zod";
import {
  Purpose,
  PurposeVersion,
  PurposeVersionDocument,
} from "../purpose/purpose.js";

export const PurposeVersionDocumentReadModel = PurposeVersionDocument.extend({
  createdAt: z.string().datetime(),
});
export type PurposeVersionDocumentReadModel = z.infer<
  typeof PurposeVersionDocumentReadModel
>;

export const PurposeVersionReadModel = PurposeVersion.extend({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  firstActivationAt: z.string().datetime().optional(),
  suspendedAt: z.string().datetime().optional(),
  riskAnalysis: PurposeVersionDocumentReadModel.optional(),
});
export type PurposeVersionReadModel = z.infer<typeof PurposeVersionReadModel>;

export const PurposeReadModel = Purpose.extend({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  versions: z.array(PurposeVersionReadModel),
});
export type PurposeReadModel = z.infer<typeof PurposeReadModel>;
