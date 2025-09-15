import { z } from "zod";
import {
  KafkaConsumerConfig,
  ReadModelDbConfig,
  ReadModelSQLDbConfig,
  SelfcareConsumerConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";

export const SelfcareClientUsersUpdaterConsumerConfig = KafkaConsumerConfig.and(
  TokenGenerationConfig
)
  .and(ReadModelDbConfig)
  .and(ReadModelSQLDbConfig.optional())
  .and(SelfcareConsumerConfig)
  .and(
    z
      .object({
        AUTHORIZATION_PROCESS_URL: z.string(),
      })
      .transform((c) => ({
        authorizationProcessUrl: c.AUTHORIZATION_PROCESS_URL,
      }))
  );

export type SelfcareClientUsersUpdaterConsumerConfig = z.infer<
  typeof SelfcareClientUsersUpdaterConsumerConfig
>;

export const config: SelfcareClientUsersUpdaterConsumerConfig =
  SelfcareClientUsersUpdaterConsumerConfig.parse(process.env);
