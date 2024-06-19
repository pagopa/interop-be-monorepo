import {
  AuthorizationTopicConfig,
  ReadModelWriterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const KeyReadModelWriterConfig = ReadModelWriterConfig.and(
  AuthorizationTopicConfig
);

export type KeyReadModelWriterConfig = z.infer<typeof KeyReadModelWriterConfig>;

export const config: KeyReadModelWriterConfig = KeyReadModelWriterConfig.parse(
  process.env
);
