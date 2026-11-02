import { z } from "zod";

export const InteropContext = z.object({
  correlationId: z.string(),
  bearerToken: z.string(),
});

export type InteropContext = z.infer<typeof InteropContext>;
