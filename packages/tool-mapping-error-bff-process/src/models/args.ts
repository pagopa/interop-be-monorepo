import { z } from "zod";

export const Args = z.object({
  process: z.string().optional(),
  output: z.string().optional(),
  filterBff: z.boolean().default(false),
  showBff: z.boolean().default(false),
  prettyPrint: z.boolean().default(false),
  includeInternalAndMaintenance: z.boolean().default(false),
  includeFrontend: z.boolean().default(false),
  limit: z.number().int().optional(),
  offset: z.number().int().optional(),
});

export type Args = z.infer<typeof Args>;
