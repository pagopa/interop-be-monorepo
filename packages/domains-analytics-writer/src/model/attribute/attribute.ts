import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  attributeInReadmodelAttribute,
  AttributeSQL,
} from "pagopa-interop-readmodel-models";

export const AttributeSchema = createSelectSchema(
  attributeInReadmodelAttribute
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AttributeSchema = z.infer<typeof AttributeSchema>;

export type AttributeMapping = {
  [K in keyof AttributeSchema]: (record: AttributeSQL) => AttributeSchema[K];
};

export const AttributeDeletingSchema = AttributeSchema.pick({
  id: true,
  deleted: true,
});
export type AttributeDeletingSchema = z.infer<typeof AttributeDeletingSchema>;

export type AttributeDeletingMapping = {
  [K in keyof AttributeDeletingSchema]: (
    record: Pick<AttributeSQL, "id">
  ) => AttributeDeletingSchema[K];
};
