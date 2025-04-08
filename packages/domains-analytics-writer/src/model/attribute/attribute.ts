// attribute.ts
import { AttributeSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const attributeSchema = z.object({
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

export type AttributeSchema = z.infer<typeof attributeSchema>;

export type AttributeMapping = {
  [K in keyof AttributeSchema]: (record: AttributeSQL) => AttributeSchema[K];
};
