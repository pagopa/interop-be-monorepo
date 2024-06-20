import {
  AuthorizationTopicConfig,
  ReadModelWriterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const ClientReadModelWriterConfig = ReadModelWriterConfig.and(
  AuthorizationTopicConfig
);

export type ClientReadModelWriterConfig = z.infer<
  typeof ClientReadModelWriterConfig
>;

export const config: ClientReadModelWriterConfig =
  ClientReadModelWriterConfig.parse(process.env);
