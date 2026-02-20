import { z } from "zod";
import {
  APIEndpoint,
  KafkaConsumerConfig,
  ReadModelSQLDbConfig,
  SelfcareConsumerConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";

const NotificationUserLifecycleConsumerConfig = KafkaConsumerConfig.and(
  TokenGenerationConfig
)
  .and(ReadModelSQLDbConfig)
  .and(SelfcareConsumerConfig)
  .and(TokenGenerationConfig)
  .and(
    z
      .object({
        NOTIFICATION_CONFIG_PROCESS_URL: APIEndpoint,
        TENANT_LOOKUP_MAX_RETRIES: z.coerce.number().default(3),
        TENANT_LOOKUP_RETRY_DELAY_MS: z.coerce.number().default(10000),
      })
      .transform((c) => ({
        notificationConfigProcessUrl: c.NOTIFICATION_CONFIG_PROCESS_URL,
        tenantLookupMaxRetries: c.TENANT_LOOKUP_MAX_RETRIES,
        tenantLookupRetryDelayMs: c.TENANT_LOOKUP_RETRY_DELAY_MS,
      }))
  );

type NotificationUserLifecycleConsumerConfig = z.infer<
  typeof NotificationUserLifecycleConsumerConfig
>;

export const config: NotificationUserLifecycleConsumerConfig =
  NotificationUserLifecycleConsumerConfig.parse(process.env);
