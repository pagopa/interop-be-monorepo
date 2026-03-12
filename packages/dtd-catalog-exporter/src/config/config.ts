import {
  FileManagerConfig,
  LoggerConfig,
  ReadModelSQLDbConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

const DtdCatalogExporterConfig = ReadModelSQLDbConfig.and(FileManagerConfig)
  .and(S3Config)
  .and(LoggerConfig)
  .and(
    z
      .object({
        DTD_CATALOG_STORAGE_PATH: z.string(),
        DTD_CATALOG_JSON_FILENAME: z.string(),
        DTD_CATALOG_CSV_FILENAME: z.string(),
        DTD_TENANTS_CSV_FILENAME: z.string(),
        DTD_TENANTS_JSON_FILENAME: z.string(),
        GITHUB_ACCESS_TOKEN: z.string(),
        GITHUB_REPO: z.string(),
        GITHUB_REPO_OWNER: z.string(),
      })
      .transform((c) => ({
        dtdCatalogStoragePath: c.DTD_CATALOG_STORAGE_PATH,
        dtdCatalogJsonFilename: c.DTD_CATALOG_JSON_FILENAME,
        dtdCatalogCsvFilename: c.DTD_CATALOG_CSV_FILENAME,
        dtdTenantsJsonFilename: c.DTD_TENANTS_JSON_FILENAME,
        dtdTenantsCsvFilename: c.DTD_TENANTS_CSV_FILENAME,
        githubAccessToken: c.GITHUB_ACCESS_TOKEN,
        githubRepo: c.GITHUB_REPO,
        githubRepoOwner: c.GITHUB_REPO_OWNER,
      }))
  );

type DtdCatalogExporterConfig = z.infer<typeof DtdCatalogExporterConfig>;
export const config: DtdCatalogExporterConfig = DtdCatalogExporterConfig.parse(
  process.env
);
