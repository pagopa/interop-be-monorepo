import {
  KafkaConsumerConfig,
  TenantKindHistoryDBConfig,
  TenantTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const TenantKindHistoryConsumerConfig = KafkaConsumerConfig.and(
  TenantTopicConfig
).and(TenantKindHistoryDBConfig);

type TenantKindHistoryConsumerConfig = z.infer<
  typeof TenantKindHistoryConsumerConfig
>;

export const config: TenantKindHistoryConsumerConfig =
  TenantKindHistoryConsumerConfig.parse(process.env);
