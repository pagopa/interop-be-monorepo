import {
  CatalogTopicConfig,
  PlatformStateWriterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const CatalogPlatformStateWriterConfig =
  PlatformStateWriterConfig.and(CatalogTopicConfig);

export type CatalogPlatformStateWriterConfig = z.infer<
  typeof CatalogPlatformStateWriterConfig
>;

export const config: CatalogPlatformStateWriterConfig =
  CatalogPlatformStateWriterConfig.parse(process.env);
