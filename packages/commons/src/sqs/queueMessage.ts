import { z } from "zod";

export const QueueMessage = z.object({
  spanId: z.string().uuid(),
  correlationId: z.string().uuid(),
  payload: z.unknown(),
});

export type QueueMessage = z.infer<typeof QueueMessage>;
