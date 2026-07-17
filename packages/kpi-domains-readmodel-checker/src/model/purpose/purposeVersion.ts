import { createSelectSchema } from "drizzle-zod";
import { purposeVersionInReadmodelPurpose } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeVersionSchema = createSelectSchema(
  purposeVersionInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeVersionSchema = z.infer<typeof PurposeVersionSchema>;
