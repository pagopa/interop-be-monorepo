import {
  KafkaConsumerConfig,
  TenantTopicConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const NotificationTenantLifecycleConsumerConfig =
  KafkaConsumerConfig.and(TenantTopicConfig)
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

export type NotificationTenantLifecycleConsumerConfig = z.infer<
  typeof NotificationTenantLifecycleConsumerConfig
>;

export const config: NotificationTenantLifecycleConsumerConfig =
  NotificationTenantLifecycleConsumerConfig.parse(process.env);
