import z from "zod";

export const attributeKind = {
  certified: "Certified",
  declared: "Declared",
  verified: "Verified",
} as const;
export const AttributeKind = z.enum([
  Object.values(attributeKind)[0],
  ...Object.values(attributeKind).slice(1),
]);
export type AttributeKind = z.infer<typeof AttributeKind>;

export const attribute = z.object({
  id: z.string().uuid(),
  code: z.string().optional(),
  origin: z.string().optional(),
  kind: AttributeKind,
  description: z.string(),
  name: z.string(),
  creationTime: z.date(),
});

export type Attribute = z.infer<typeof attribute>;
