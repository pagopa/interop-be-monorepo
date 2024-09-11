import { z } from "zod";

export const PersistentAttribute = z.object({
  id: z.string().uuid(),
  origin: z.string(),
  code: z.string(),
});
export type PersistentAttribute = z.infer<typeof PersistentAttribute>;
