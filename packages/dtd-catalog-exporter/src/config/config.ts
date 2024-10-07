import {
  FileManagerConfig,
  LoggerConfig,
  ReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const DtdCatalogExporterConfig = ReadModelDbConfig.and(FileManagerConfig)
  .and(LoggerConfig)
  .and(
    z
      .object({
        DTD_CATALOG_STORAGE_BUCKET: z.string(),
        DTD_CATALOG_STORAGE_PATH: z.string(),
        DTD_CATALOG_FILENAME: z.string(),
      })
      .transform((c) => ({
        dtdCatalogStorageBucket: c.DTD_CATALOG_STORAGE_BUCKET,
        dtdCatalogStoragePath: c.DTD_CATALOG_STORAGE_PATH,
        dtdCatalogFilename: c.DTD_CATALOG_FILENAME,
      }))
  );

export type DtdCatalogExporterConfig = z.infer<typeof DtdCatalogExporterConfig>;
export const config: DtdCatalogExporterConfig = DtdCatalogExporterConfig.parse(
  process.env
);
