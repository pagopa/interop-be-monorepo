import {
  CatalogProcessServerConfig,
  LoggerConfig,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const EServiceDescriptorsScheduledArchiverConfig = ReadModelSQLDbConfig.and(
  TokenGenerationConfig
)
  .and(LoggerConfig)
  .and(CatalogProcessServerConfig)
  .and(
    z
      .object({
        CATALOG_API_CONCURRENCY: z.coerce.number().positive().default(5),
        DEFAULT_POLLING_RETRY_DELAY: z.coerce.number().default(1000),
        DEFAULT_POLLING_MAX_RETRIES: z.coerce.number().default(5),
      })
      .transform((c) => ({
        catalogApiConcurrency: c.CATALOG_API_CONCURRENCY,
        defaultPollingRetryDelay: c.DEFAULT_POLLING_RETRY_DELAY,
        defaultPollingMaxRetries: c.DEFAULT_POLLING_MAX_RETRIES,
      }))
  );
type EServiceDescriptorsScheduledArchiverConfig = z.infer<
  typeof EServiceDescriptorsScheduledArchiverConfig
>;
export const config: EServiceDescriptorsScheduledArchiverConfig =
  EServiceDescriptorsScheduledArchiverConfig.parse(process.env);
