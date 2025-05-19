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

export const PurposeVersionDeletingSchema = PurposeVersionSchema.pick({
  id: true,
  deleted: true,
});
export type PurposeVersionDeletingSchema = z.infer<
  typeof PurposeVersionDeletingSchema
>;

export const PurposeVersionItemsSchema = z.object({
  versionSQL: PurposeVersionSchema,
  versionDocumentSQL: PurposeVersionDocumentSchema.optional(),
});
export type PurposeVersionItemsSchema = z.infer<
  typeof PurposeVersionItemsSchema
>;
