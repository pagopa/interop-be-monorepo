import {
  ApplicationAuditTopicConfig,
  KafkaProducerConfig,
  LoggerConfig,
  ApplicationAuditFallbackSQSConsumerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const ApplicationAuditFallbackConfig =
  ApplicationAuditFallbackSQSConsumerConfig.and(KafkaProducerConfig)
    .and(ApplicationAuditTopicConfig)
    .and(LoggerConfig)
    .and(
      z
        .object({
          SERVICE_NAME: z.string(),
        })
        .transform((c) => ({
          serviceName: c.SERVICE_NAME,
        }))
    );

export type ApplicationAuditFallbackConfig = z.infer<
  typeof ApplicationAuditFallbackConfig
>;

export const config: ApplicationAuditFallbackConfig =
  ApplicationAuditFallbackConfig.parse(process.env);
