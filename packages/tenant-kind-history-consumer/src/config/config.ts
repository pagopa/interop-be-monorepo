import {
  KafkaConsumerConfig,
  TenantTopicConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const TenantKindHistoryConsumerConfig = KafkaConsumerConfig.and(
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

type TenantKindHistoryConsumerConfig = z.infer<
  typeof TenantKindHistoryConsumerConfig
>;

export const config: TenantKindHistoryConsumerConfig =
  TenantKindHistoryConsumerConfig.parse(process.env);
