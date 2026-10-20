import {
  AuthorizationProcessServerConfig,
  KafkaConsumerConfig,
  ReadModelSQLDbConfig,
  SelfcareConsumerConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const SelfcareClientUsersUpdaterConsumerConfig = KafkaConsumerConfig.and(
  TokenGenerationConfig
)
  .and(ReadModelSQLDbConfig)
  .and(SelfcareConsumerConfig)
  .and(AuthorizationProcessServerConfig);

type SelfcareClientUsersUpdaterConsumerConfig = z.infer<
  typeof SelfcareClientUsersUpdaterConsumerConfig
>;

export const config: SelfcareClientUsersUpdaterConsumerConfig =
  SelfcareClientUsersUpdaterConsumerConfig.parse(process.env);
