import {
  AuthorizationTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

const ClientReadModelWriterConfig = ReadModelWriterConfigSQL.and(
  AuthorizationTopicConfig
);

type ClientReadModelWriterConfig = z.infer<typeof ClientReadModelWriterConfig>;

export const config: ClientReadModelWriterConfig =
  ClientReadModelWriterConfig.parse(process.env);
