import {
  CatalogTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

const CatalogReadModelWriterConfig =
  ReadModelWriterConfigSQL.and(CatalogTopicConfig);

type CatalogReadModelWriterConfig = z.infer<
  typeof CatalogReadModelWriterConfig
>;

export const config: CatalogReadModelWriterConfig =
  CatalogReadModelWriterConfig.parse(process.env);
