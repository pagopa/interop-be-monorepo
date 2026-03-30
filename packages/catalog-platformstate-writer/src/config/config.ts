import {
  CatalogTopicConfig,
  FeatureFlagAsyncExchangeConfig,
  PlatformStateWriterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const CatalogPlatformStateWriterConfig = PlatformStateWriterConfig.and(
  CatalogTopicConfig
).and(FeatureFlagAsyncExchangeConfig);

type CatalogPlatformStateWriterConfig = z.infer<
  typeof CatalogPlatformStateWriterConfig
>;

export const config: CatalogPlatformStateWriterConfig =
  CatalogPlatformStateWriterConfig.parse(process.env);
