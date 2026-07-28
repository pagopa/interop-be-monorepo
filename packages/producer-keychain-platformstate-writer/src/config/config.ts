import {
  AuthorizationTopicConfig,
  KafkaConsumerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const ProducerKeychainPlatformStateWriterConfig = AuthorizationTopicConfig.and(
  KafkaConsumerConfig
).and(
  z
    .object({
      PRODUCER_KEYCHAIN_PLATFORM_STATES_TABLE_NAME: z.string(),
    })
    .transform((c) => ({
      producerKeychainPlatformStatesTableName:
        c.PRODUCER_KEYCHAIN_PLATFORM_STATES_TABLE_NAME,
    }))
);

type ProducerKeychainPlatformStateWriterConfig = z.infer<
  typeof ProducerKeychainPlatformStateWriterConfig
>;

export const config: ProducerKeychainPlatformStateWriterConfig =
  ProducerKeychainPlatformStateWriterConfig.parse(process.env);
