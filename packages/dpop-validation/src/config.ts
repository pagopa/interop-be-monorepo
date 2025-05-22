import { z } from "zod";

export const DPoPConfig = z
  .object({
    DPOP_CACHE_TABLE: z.string(),
    DPOP_HTU: z.string(),
  })
  .transform((c) => ({
    dPoPCacheTable: c.DPOP_CACHE_TABLE,
    dPoPHtu: c.DPOP_HTU,
  }));
export type DPoPConfig = z.infer<typeof DPoPConfig>;
