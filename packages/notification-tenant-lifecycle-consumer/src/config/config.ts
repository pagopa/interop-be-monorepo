import {
  KafkaConsumerConfig,
  NotificationConfigProcessServerConfig,
  TenantTopicConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const NotificationTenantLifecycleConsumerConfig = KafkaConsumerConfig.and(
  TenantTopicConfig
)
  .and(TokenGenerationConfig)
  .and(NotificationConfigProcessServerConfig);

type NotificationTenantLifecycleConsumerConfig = z.infer<
  typeof NotificationTenantLifecycleConsumerConfig
>;

export const config: NotificationTenantLifecycleConsumerConfig =
  NotificationTenantLifecycleConsumerConfig.parse(process.env);
