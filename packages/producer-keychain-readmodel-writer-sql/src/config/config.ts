import {
  AuthorizationTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

export const ProducerKeychainReadModelWriterConfig =
  ReadModelWriterConfigSQL.and(AuthorizationTopicConfig);

export type ProducerKeychainReadModelWriterConfig = z.infer<
  typeof ProducerKeychainReadModelWriterConfig
>;

export const config: ProducerKeychainReadModelWriterConfig =
  ProducerKeychainReadModelWriterConfig.parse(process.env);
