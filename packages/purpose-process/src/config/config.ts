import {
  CommonHTTPServiceConfig,
  EventStoreConfig,
  FileManagerConfig,
  S3Config,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
  FeatureFlagPurposeTemplateConfig,
  TenantKindHistoryDBConfig,
  FeatureFlagTenantKindInRiskAnalysisConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeProcessConfig = CommonHTTPServiceConfig.and(ReadModelSQLDbConfig)
  .and(EventStoreConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(TenantKindHistoryDBConfig)
  .and(FeatureFlagTenantKindInRiskAnalysisConfig)
  .and(
    z
      .object({
        RISK_ANALYSIS_DOCUMENTS_PATH: z.string(),
      })
      .transform((c) => ({
        riskAnalysisDocumentsPath: c.RISK_ANALYSIS_DOCUMENTS_PATH,
      }))
  )
  .and(ApplicationAuditProducerConfig)
  .and(FeatureFlagPurposeTemplateConfig);

type PurposeProcessConfig = z.infer<typeof PurposeProcessConfig>;

export const config: PurposeProcessConfig = PurposeProcessConfig.parse(
  process.env
);
