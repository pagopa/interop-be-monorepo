import { z } from "zod";

export const SQSConsumerConfig = z
  .object({
    CONSUMER_SQS_MAX_NUMBER_OF_MSGS: z.coerce
      .number()
      .min(1)
      .max(10)
      .default(10),
    CONSUMER_SQS_LONG_POLL_WAIT_TIME_SECONDS: z.coerce
      .number()
      .min(1)
      .max(20)
      .default(10),
    CONSUMER_SQS_VISIBILITY_TIMEOUT_SECONDS: z.coerce
      .number()
      .min(10)
      .default(30),
    CONSUMER_SQS_QUEUE_URL: z.string(),
  })
  .transform((c) => ({
    maxNumberOfMessages: c.CONSUMER_SQS_MAX_NUMBER_OF_MSGS,
    waitTimeSeconds: c.CONSUMER_SQS_LONG_POLL_WAIT_TIME_SECONDS,
    visibilityTimeout: c.CONSUMER_SQS_VISIBILITY_TIMEOUT_SECONDS,
    consumerQueueUrl: c.CONSUMER_SQS_QUEUE_URL,
  }));

export type SQSConsumerConfig = z.infer<typeof SQSConsumerConfig>;
