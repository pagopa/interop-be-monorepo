import { createSelectSchema } from "drizzle-zod";
import { purposeVersionStampInReadmodelPurpose } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeVersionStampSchema = createSelectSchema(
  purposeVersionStampInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeVersionStampSchema = z.infer<
  typeof PurposeVersionStampSchema
>;
