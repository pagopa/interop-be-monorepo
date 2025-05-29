import { z } from "zod";

export const ApplicationAuditFallbackSQSConsumerConfig = z
  .object({
    APPLICATION_AUDIT_FALLBACK_SQS_MAX_NUMBER_OF_MSGS: z.coerce
      .number()
      .min(1)
      .max(10)
      .default(10),
    APPLICATION_AUDIT_FALLBACK_SQS_LONG_POLL_WAIT_TIME_SECONDS: z.coerce
      .number()
      .min(1)
      .max(20)
      .default(10),
    APPLICATION_AUDIT_FALLBACK_SQS_VISIBILITY_TIMEOUT_SECONDS: z.coerce
      .number()
      .min(10)
      .default(30),
    APPLICATION_AUDIT_FALLBACK_SQS_URL: z.string(),
  })
  .transform((c) => ({
    maxNumberOfMessages: c.APPLICATION_AUDIT_FALLBACK_SQS_MAX_NUMBER_OF_MSGS,
    waitTimeSeconds:
      c.APPLICATION_AUDIT_FALLBACK_SQS_LONG_POLL_WAIT_TIME_SECONDS,
    visibilityTimeout:
      c.APPLICATION_AUDIT_FALLBACK_SQS_VISIBILITY_TIMEOUT_SECONDS,
    consumerQueueUrl: c.APPLICATION_AUDIT_FALLBACK_SQS_URL,
  }));

export type ApplicationAuditFallbackSQSConsumerConfig = z.infer<
  typeof ApplicationAuditFallbackSQSConsumerConfig
>;
