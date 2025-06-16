import { z } from "zod";

export const DPoPConfig = z
  .object({
    DPOP_CACHE_TABLE: z.string(),
    DPOP_HTU: z.string(),
  })
  .transform((c) => ({
    dpopCacheTable: c.DPOP_CACHE_TABLE,
    dpopHtu: c.DPOP_HTU,
  }));
export type DPoPConfig = z.infer<typeof DPoPConfig>;
