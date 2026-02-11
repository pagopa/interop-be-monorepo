import { z } from "zod";

export const DPoPConfig = z
  .object({
    DPOP_CACHE_TABLE: z.string(),
    DPOP_HTU_BASE: z.string(),
    DPOP_IAT_TOLERANCE_SECONDS: z.coerce.number(),
    DPOP_DURATION_SECONDS: z.coerce.number(),
  })
  .transform((c) => ({
    dpopCacheTable: c.DPOP_CACHE_TABLE,
    dpopHtuBase: c.DPOP_HTU_BASE,
    dpopIatToleranceSeconds: c.DPOP_IAT_TOLERANCE_SECONDS,
    dpopDurationSeconds: c.DPOP_DURATION_SECONDS,
  }));
export type DPoPConfig = z.infer<typeof DPoPConfig>;
