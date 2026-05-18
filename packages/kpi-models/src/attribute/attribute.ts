import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { attributeInReadmodelAttribute } from "pagopa-interop-readmodel-models";

export const AttributeSchema = createSelectSchema(
  attributeInReadmodelAttribute
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AttributeSchema = z.infer<typeof AttributeSchema>;
