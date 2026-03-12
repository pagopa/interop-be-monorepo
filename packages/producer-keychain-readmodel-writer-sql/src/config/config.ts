import {
  AuthorizationTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

const ProducerKeychainReadModelWriterConfig = ReadModelWriterConfigSQL.and(
  AuthorizationTopicConfig
);

type ProducerKeychainReadModelWriterConfig = z.infer<
  typeof ProducerKeychainReadModelWriterConfig
>;

export const config: ProducerKeychainReadModelWriterConfig =
  ProducerKeychainReadModelWriterConfig.parse(process.env);
