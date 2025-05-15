import { z } from "zod";

export const ApplicationAuditFallbackSQSProducerConfig = z
  .object({
    APPLICATION_AUDIT_FALLBACK_SQS_URL: z.string(),
  })
  .transform((c) => ({
    producerQueueUrl: c.APPLICATION_AUDIT_FALLBACK_SQS_URL,
  }));

export type ApplicationAuditFallbackSQSProducerConfig = z.infer<
  typeof ApplicationAuditFallbackSQSProducerConfig
>;
