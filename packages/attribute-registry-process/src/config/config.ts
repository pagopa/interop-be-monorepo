import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  EventStoreConfig,
  ApplicationAuditProducerConfig,
  FeatureFlagSQLConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const AttributeRegistryConfig = CommonHTTPServiceConfig.and(ReadModelDbConfig)
  .and(EventStoreConfig)
  .and(
    z.object({ PRODUCER_ALLOWED_ORIGINS: z.string() }).transform((c) => ({
      producerAllowedOrigins: c.PRODUCER_ALLOWED_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    }))
  )
  .and(ApplicationAuditProducerConfig)
  .and(FeatureFlagSQLConfig)
  .and(ReadModelSQLDbConfig);

export type AttributeRegistryConfig = z.infer<typeof AttributeRegistryConfig>;

export const config: AttributeRegistryConfig = AttributeRegistryConfig.parse(
  process.env
);
