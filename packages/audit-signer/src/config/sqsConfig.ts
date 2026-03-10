import { z } from "zod";

export const SQSConsumerConfig = z
  .object({
    SQS_MAX_NUMBER_OF_MSGS: z.coerce.number().min(1).max(10).default(10),
    SQS_LONG_POLL_WAIT_TIME_SECONDS: z.coerce
      .number()
      .min(1)
      .max(20)
      .default(10),
    SQS_VISIBILITY_TIMEOUT_SECONDS: z.coerce.number().min(10).default(30),
    SQS_URL: z.string(),
  })
  .transform((c) => ({
    maxNumberOfMessages: c.SQS_MAX_NUMBER_OF_MSGS,
    waitTimeSeconds: c.SQS_LONG_POLL_WAIT_TIME_SECONDS,
    visibilityTimeout: c.SQS_VISIBILITY_TIMEOUT_SECONDS,
    consumerQueueUrl: c.SQS_URL,
  }));

export type SQSConsumerConfig = z.infer<typeof SQSConsumerConfig>;
