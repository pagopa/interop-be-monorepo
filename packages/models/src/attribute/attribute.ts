import z from "zod";

export const persistentAttributeKind = {
  certified: "Certified",
  declared: "Declared",
  verified: "Verified",
} as const;
export const PersistentAttributeKind = z.enum([
  Object.values(persistentAttributeKind)[0],
  ...Object.values(persistentAttributeKind).slice(1),
]);
export type PersistentAttributeKind = z.infer<typeof PersistentAttributeKind>;

const PersistentAttribute = z.object({
  id: z.string().uuid(),
  code: z.string().optional(),
  origin: z.string().optional(),
  kind: PersistentAttributeKind,
  description: z.string(),
  name: z.string(),
  creationTime: z.date(),
});

export type PersistentAttribute = z.infer<typeof PersistentAttribute>;
