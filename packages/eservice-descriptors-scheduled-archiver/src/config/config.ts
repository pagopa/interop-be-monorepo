import {
  LoggerConfig,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const EServiceDescriptorsScheduledArchiverConfig = ReadModelSQLDbConfig.and(
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
type EServiceDescriptorsScheduledArchiverConfig = z.infer<
  typeof EServiceDescriptorsScheduledArchiverConfig
>;
export const config: EServiceDescriptorsScheduledArchiverConfig =
  EServiceDescriptorsScheduledArchiverConfig.parse(process.env);
