import {
  AttributeTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

const AttributeRegistryReadModelWriterConfig =
  ReadModelWriterConfigSQL.and(AttributeTopicConfig);

type AttributeRegistryReadModelWriterConfig = z.infer<
  typeof AttributeRegistryReadModelWriterConfig
>;

export const config: AttributeRegistryReadModelWriterConfig =
  AttributeRegistryReadModelWriterConfig.parse(process.env);
