import { createSelectSchema } from "drizzle-zod";
import { purposeVersionDocumentInReadmodelPurpose } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeVersionDocumentSchema = createSelectSchema(
  purposeVersionDocumentInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeVersionDocumentSchema = z.infer<
  typeof PurposeVersionDocumentSchema
>;
