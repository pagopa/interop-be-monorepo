import {
  FileManagerConfig,
  LoggerConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const DatalakeStorageConfig = z
  .object({
    DATALAKE_STORAGE_BUCKET: z.string(),
  })
  .transform((c) => ({
    dataLakeStorageBucket: c.DATALAKE_STORAGE_BUCKET,
  }));
export type DatalakeStorageConfig = z.infer<typeof DatalakeExporterConfig>;

export const DatalakeExporterConfig = DatalakeStorageConfig.and(LoggerConfig)
  .and(FileManagerConfig)
  .and(ReadModelSQLDbConfig);

export type DatalakeExporterConfig = z.infer<typeof DatalakeExporterConfig>;
export const config: DatalakeExporterConfig = DatalakeExporterConfig.parse(
  process.env
);
