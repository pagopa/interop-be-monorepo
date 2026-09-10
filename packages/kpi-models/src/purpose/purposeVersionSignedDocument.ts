import { createSelectSchema } from "drizzle-zod";
import { purposeVersionSignedDocumentInReadmodelPurpose } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeVersionSignedDocumentSchema = createSelectSchema(
  purposeVersionSignedDocumentInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeVersionSignedDocumentSchema = z.infer<
  typeof PurposeVersionSignedDocumentSchema
>;
