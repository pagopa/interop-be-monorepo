import {
  CommonHTTPServiceConfig,
  EventStoreConfig,
  FileManagerConfig,
  S3Config,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
  FeatureFlagPurposesProcessContractBuilderConfig,
  FeatureFlagPurposeTemplateConfig,
  TenantKindHistoryDBConfig,
  FeatureFlagTenantKindInRiskAnalysisWriteConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeProcessConfig = CommonHTTPServiceConfig.and(ReadModelSQLDbConfig)
  .and(EventStoreConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(FeatureFlagPurposesProcessContractBuilderConfig)
  .and(TenantKindHistoryDBConfig)
  .and(FeatureFlagTenantKindInRiskAnalysisWriteConfig)
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

export type PurposeProcessConfig = z.infer<typeof PurposeProcessConfig>;

export const config: PurposeProcessConfig = PurposeProcessConfig.parse(
  process.env
);
