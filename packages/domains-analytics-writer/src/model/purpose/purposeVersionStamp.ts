import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { purposeVersionStampInReadmodelPurpose } from "pagopa-interop-readmodel-models";

export const PurposeVersionStampSchema = createSelectSchema(
  purposeVersionStampInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeVersionStampSchema = z.infer<
  typeof PurposeVersionStampSchema
>;
