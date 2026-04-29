import {
  LoggerConfig,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const EServiceDescriptorsArchiverSchedulerConfig = ReadModelSQLDbConfig.and(
  TokenGenerationConfig
)
  .and(ReadModelSQLDbConfig)
  .and(LoggerConfig)
  .and(
    z
      .object({
        CATALOG_PROCESS_URL: z.string(),
      })
      .transform((c) => ({
        catalogProcessUrl: c.CATALOG_PROCESS_URL,
      }))
  );
type EServiceDescriptorsArchiverSchedulerConfig = z.infer<
  typeof EServiceDescriptorsArchiverSchedulerConfig
>;
export const config: EServiceDescriptorsArchiverSchedulerConfig =
  EServiceDescriptorsArchiverSchedulerConfig.parse(process.env);
