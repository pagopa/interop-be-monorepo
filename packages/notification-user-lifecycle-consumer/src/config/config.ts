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
      })
      .transform((c) => ({
        notificationConfigProcessUrl: c.NOTIFICATION_CONFIG_PROCESS_URL,
      }))
  );

type NotificationUserLifecycleConsumerConfig = z.infer<
  typeof NotificationUserLifecycleConsumerConfig
>;

export const config: NotificationUserLifecycleConsumerConfig =
  NotificationUserLifecycleConsumerConfig.parse(process.env);
