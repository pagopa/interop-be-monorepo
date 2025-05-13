import {
  APIEndpoint,
  FeatureFlagSQLConfig,
  LoggerConfig,
  ReadModelDbConfig,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";
import { SftpConfig } from "./sftpConfig.js";

const AnacCertifiedAttributesImporterConfig = LoggerConfig.and(
  ReadModelDbConfig
)
  .and(SftpConfig)
  .and(TokenGenerationConfig)
  .and(
    z
      .object({
        TENANT_PROCESS_URL: APIEndpoint,
        RECORDS_PROCESS_BATCH_SIZE: z.coerce.number(),
        ANAC_TENANT_ID: z.string(),
      })
      .transform((c) => ({
        tenantProcessUrl: c.TENANT_PROCESS_URL,
        recordsProcessBatchSize: c.RECORDS_PROCESS_BATCH_SIZE,
        anacTenantId: c.ANAC_TENANT_ID,
      }))
  )
  .and(FeatureFlagSQLConfig)
  .and(ReadModelSQLDbConfig);

export type AnacCertifiedAttributesImporterConfig = z.infer<
  typeof AnacCertifiedAttributesImporterConfig
>;

export const config: AnacCertifiedAttributesImporterConfig =
  AnacCertifiedAttributesImporterConfig.parse(process.env);
