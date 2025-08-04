import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { purposeInReadmodelPurpose } from "pagopa-interop-readmodel-models";

export const PurposeSchema = createSelectSchema(
  purposeInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeSchema = z.infer<typeof PurposeSchema>;
