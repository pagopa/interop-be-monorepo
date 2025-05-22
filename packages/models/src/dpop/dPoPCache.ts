import { z } from "zod";

export const DPoPCache = z.object({
  jti: z.string(),
  iat: z.string().datetime(),
  ttl: z.number().int().min(0),
});
export type DPoPCache = z.infer<typeof DPoPCache>;
