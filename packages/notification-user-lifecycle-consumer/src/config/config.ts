import { z } from "zod";
import {
  KafkaConsumerConfig,
  ReadModelSQLDbConfig,
  SelfcareConsumerConfig,
  TokenGenerationConfig,
  UserSQLDbConfig,
} from "pagopa-interop-commons";

export const SelfcareClientUsersUpdaterConsumerConfig = KafkaConsumerConfig.and(
  TokenGenerationConfig
)
  .and(ReadModelSQLDbConfig)
  .and(SelfcareConsumerConfig)
  .and(UserSQLDbConfig);

export type SelfcareClientUsersUpdaterConsumerConfig = z.infer<
  typeof SelfcareClientUsersUpdaterConsumerConfig
>;

export const config: SelfcareClientUsersUpdaterConsumerConfig =
  SelfcareClientUsersUpdaterConsumerConfig.parse(process.env);
