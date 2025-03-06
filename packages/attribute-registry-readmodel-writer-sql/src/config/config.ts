import {
  AttributeTopicConfig,
  ReadModelWriterSQLConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const AttributeRegistryReadModelWriterConfig =
  ReadModelWriterSQLConfig.and(AttributeTopicConfig);

export type AttributeRegistryReadModelWriterConfig = z.infer<
  typeof AttributeRegistryReadModelWriterConfig
>;

export const config: AttributeRegistryReadModelWriterConfig =
  AttributeRegistryReadModelWriterConfig.parse(process.env);
