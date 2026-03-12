import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { purposeVersionSignedDocumentInReadmodelPurpose } from "pagopa-interop-readmodel-models";

export const PurposeVersionSignedDocumentSchema = createSelectSchema(
  purposeVersionSignedDocumentInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeVersionSignedDocumentSchema = z.infer<
  typeof PurposeVersionSignedDocumentSchema
>;
