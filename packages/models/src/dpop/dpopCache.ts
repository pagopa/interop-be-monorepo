import { z } from "zod";

export const DPoPCache = z.object({
  jti: z.string(),
  iat: z.number().int().min(0),
  ttl: z.number().int().min(0),
});
export type DPoPCache = z.infer<typeof DPoPCache>;
