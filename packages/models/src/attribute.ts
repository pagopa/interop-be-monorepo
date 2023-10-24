import { z } from "zod";

export const attributeKind = {
  certified: "CERTIFIED",
  verified: "VERIFIED",
  declared: "DECLARED",
} as const;
export const AttributeKind = z.enum([
  Object.values(attributeKind)[0],
  ...Object.values(attributeKind).slice(1),
]);
export type AttributeKind = z.infer<typeof AttributeKind>;

export const AttributeTmp = z.object({
  id: z.string().uuid(),
  code: z.string().optional(),
  kind: AttributeKind,
  description: z.string(),
  origin: z.string().optional(),
  name: z.string(),
  creationTime: z.coerce.date(),
});
export type AttributeTmp = z.infer<typeof AttributeTmp>;
