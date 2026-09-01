import {
  KafkaConsumerConfig,
  NotificationConfigProcessServerConfig,
  ReadModelSQLDbConfig,
  SelfcareConsumerConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const NotificationUserLifecycleConsumerConfig = KafkaConsumerConfig.and(
  TokenGenerationConfig
)
  .and(ReadModelSQLDbConfig)
  .and(SelfcareConsumerConfig)
  .and(TokenGenerationConfig)
  .and(NotificationConfigProcessServerConfig)
  .and(
    z
      .object({
        TENANT_LOOKUP_MAX_RETRIES: z.coerce.number().default(3),
        TENANT_LOOKUP_RETRY_DELAY_MS: z.coerce.number().default(10000),
      })
      .transform((c) => ({
        tenantLookupMaxRetries: c.TENANT_LOOKUP_MAX_RETRIES,
        tenantLookupRetryDelayMs: c.TENANT_LOOKUP_RETRY_DELAY_MS,
      }))
  );

type NotificationUserLifecycleConsumerConfig = z.infer<
  typeof NotificationUserLifecycleConsumerConfig
>;

export const config: NotificationUserLifecycleConsumerConfig =
  NotificationUserLifecycleConsumerConfig.parse(process.env);
