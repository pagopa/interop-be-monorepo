import {
  FileManagerConfig,
  LoggerConfig,
  ReadModelDbConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

const DtdCatalogExporterConfig = ReadModelDbConfig.and(FileManagerConfig)
  .and(S3Config)
  .and(LoggerConfig)
  .and(
    z
      .object({
        DTD_CATALOG_STORAGE_PATH: z.string(),
        DTD_CATALOG_JSON_FILENAME: z.string(),
        DTD_CATALOG_CSV_FILENAME: z.string(),
        DTD_TENANTS_CSV_FILENAME: z.string(),
      })
      .transform((c) => ({
        dtdCatalogStoragePath: c.DTD_CATALOG_STORAGE_PATH,
        dtdCatalogJsonFilename: c.DTD_CATALOG_JSON_FILENAME,
        dtdCatalogCsvFilename: c.DTD_CATALOG_CSV_FILENAME,
        dtdTenantsCsvFilename: c.DTD_TENANTS_CSV_FILENAME,
      }))
  );

export type DtdCatalogExporterConfig = z.infer<typeof DtdCatalogExporterConfig>;
export const config: DtdCatalogExporterConfig = DtdCatalogExporterConfig.parse(
  process.env
);
