import { createSelectSchema } from "drizzle-zod";
import { purposeVersionInReadmodelPurpose } from "pagopa-interop-readmodel-models";
import { z } from "zod";

import { PurposeVersionDocumentSchema } from "./purposeVersionDocument.js";

// The quota approval reason belongs to the operational readmodel, not the analytics table.
export const PurposeVersionSchema = createSelectSchema(
  purposeVersionInReadmodelPurpose
)
  .omit({ waitingForApprovalReason: true })
  .extend({ deleted: z.boolean().default(false).optional() });
export type PurposeVersionSchema = z.infer<typeof PurposeVersionSchema>;

export const PurposeVersionItemsSchema = z.object({
  versionSQL: PurposeVersionSchema,
  versionDocumentSQL: PurposeVersionDocumentSchema.optional(),
});
export type PurposeVersionItemsSchema = z.infer<
  typeof PurposeVersionItemsSchema
>;
