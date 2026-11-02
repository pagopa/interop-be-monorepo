import { createSelectSchema } from "drizzle-zod";
import { attributeInReadmodelAttribute } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const AttributeSchema = createSelectSchema(
  attributeInReadmodelAttribute
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AttributeSchema = z.infer<typeof AttributeSchema>;
