import { z } from "zod";

export const keyUse = {
  sig: "Sig",
  enc: "Enc",
} as const;
export const KeyUse = z.enum([
  Object.values(keyUse)[0],
  ...Object.values(keyUse).slice(1),
]);
export type KeyUse = z.infer<typeof KeyUse>;

export const Key = z.object({
  relationshipId: z.string(),
  kid: z.string(),
  name: z.string(),
  encodedPem: z.string(),
  algorithm: z.string(),
  use: KeyUse,
  createdAt: z.coerce.date(),
});

export type Key = z.infer<typeof Key>;
