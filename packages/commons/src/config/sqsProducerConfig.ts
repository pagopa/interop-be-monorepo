import { z } from "zod";

export const SQSProducerConfig = z
  .object({
    PRODUCER_SQS_QUEUE_URL: z.string(),
  })
  .transform((c) => ({
    producerQueueUrl: c.PRODUCER_SQS_QUEUE_URL,
  }));

export type SQSProducerConfig = z.infer<typeof SQSProducerConfig>;
