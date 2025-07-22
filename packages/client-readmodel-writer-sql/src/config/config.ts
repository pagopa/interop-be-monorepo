import {
  AuthorizationTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

export const ClientReadModelWriterConfig = ReadModelWriterConfigSQL.and(
  AuthorizationTopicConfig
);

export type ClientReadModelWriterConfig = z.infer<
  typeof ClientReadModelWriterConfig
>;

export const config: ClientReadModelWriterConfig =
  ClientReadModelWriterConfig.parse(process.env);
