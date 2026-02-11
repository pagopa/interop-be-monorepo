import {
  AuthorizationTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

const KeyReadModelWriterConfig = ReadModelWriterConfigSQL.and(
  AuthorizationTopicConfig
);

type KeyReadModelWriterConfig = z.infer<typeof KeyReadModelWriterConfig>;

export const config: KeyReadModelWriterConfig = KeyReadModelWriterConfig.parse(
  process.env
);
