import {
  AuthorizationTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

export const KeyReadModelWriterConfig = ReadModelWriterConfigSQL.and(
  AuthorizationTopicConfig
);

export type KeyReadModelWriterConfig = z.infer<typeof KeyReadModelWriterConfig>;

export const config: KeyReadModelWriterConfig = KeyReadModelWriterConfig.parse(
  process.env
);
