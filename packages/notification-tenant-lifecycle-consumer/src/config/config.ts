import {
  KafkaConsumerConfig,
  TenantTopicConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const NotificationTenantLifecycleConsumerConfig = KafkaConsumerConfig.and(
  TenantTopicConfig
)
  .and(TokenGenerationConfig)
  .and(
    z
      .object({
        NOTIFICATION_CONFIG_PROCESS_URL: z.string(),
      })
      .transform((c) => ({
        notificationConfigProcessUrl: c.NOTIFICATION_CONFIG_PROCESS_URL,
      }))
  );

type NotificationTenantLifecycleConsumerConfig = z.infer<
  typeof NotificationTenantLifecycleConsumerConfig
>;

export const config: NotificationTenantLifecycleConsumerConfig =
  NotificationTenantLifecycleConsumerConfig.parse(process.env);
