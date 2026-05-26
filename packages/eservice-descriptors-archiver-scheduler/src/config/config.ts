import {
  LoggerConfig,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const EServiceDescriptorsArchiverSchedulerConfig = ReadModelSQLDbConfig.and(
  TokenGenerationConfig
)
  .and(LoggerConfig)
  .and(
    z
      .object({
        CATALOG_PROCESS_URL: z.string(),
        CATALOG_API_CONCURRENCY: z.coerce.number().positive().default(5),
      })
      .transform((c) => ({
        catalogProcessUrl: c.CATALOG_PROCESS_URL,
        catalogApiConcurrency: c.CATALOG_API_CONCURRENCY,
      }))
  );
type EServiceDescriptorsArchiverSchedulerConfig = z.infer<
  typeof EServiceDescriptorsArchiverSchedulerConfig
>;
export const config: EServiceDescriptorsArchiverSchedulerConfig =
  EServiceDescriptorsArchiverSchedulerConfig.parse(process.env);
