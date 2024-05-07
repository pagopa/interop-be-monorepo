import { z } from "zod";

export const QueueMessage = z.object({
  messageUUID: z.string().uuid(),
  eventJournalPersistenceId: z.string(),
  eventJournalSequenceNumber: z.number(),
  eventTimestamp: z.number(),
  kind: z.string(),
  payload: z.unknown(),
});

export type QueueMessage = z.infer<typeof QueueMessage>;
