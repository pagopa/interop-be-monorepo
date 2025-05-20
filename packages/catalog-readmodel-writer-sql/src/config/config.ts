import {
  CatalogTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

export const CatalogReadModelWriterConfig =
  ReadModelWriterConfigSQL.and(CatalogTopicConfig);

export type CatalogReadModelWriterConfig = z.infer<
  typeof CatalogReadModelWriterConfig
>;

export const config: CatalogReadModelWriterConfig =
  CatalogReadModelWriterConfig.parse(process.env);
