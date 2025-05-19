// attribute.ts
import { AttributeSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const AttributeSchema = z.object({
  id: z.string(),
  metadata_version: z.number(),
  code: z.string().nullable(),
  kind: z.string(),
  description: z.string(),
  origin: z.string().nullable(),
  name: z.string(),
  creation_time: z.string(),
  deleted: z.boolean(),
});
export type AttributeSchema = z.infer<typeof AttributeSchema>;

export type AttributeMapping = {
  [K in keyof Omit<AttributeSchema, "deleted">]: (
    record: AttributeSQL
  ) => Omit<AttributeSchema, "deleted">[K];
};

export const AttributeDeletingSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});
export type AttributeDeletingSchema = z.infer<typeof AttributeDeletingSchema>;
