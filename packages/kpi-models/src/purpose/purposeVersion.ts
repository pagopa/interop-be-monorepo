import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { purposeVersionInReadmodelPurpose } from "pagopa-interop-readmodel-models";
import { PurposeVersionDocumentSchema } from "./purposeVersionDocument.js";

export const PurposeVersionSchema = createSelectSchema(
  purposeVersionInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeVersionSchema = z.infer<typeof PurposeVersionSchema>;

export const PurposeVersionItemsSchema = z.object({
  versionSQL: PurposeVersionSchema,
  versionDocumentSQL: PurposeVersionDocumentSchema.optional(),
});
export type PurposeVersionItemsSchema = z.infer<
  typeof PurposeVersionItemsSchema
>;
