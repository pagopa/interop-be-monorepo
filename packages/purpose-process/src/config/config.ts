import {
  CommonHTTPServiceConfig,
  EventStoreConfig,
  FileManagerConfig,
  S3Config,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
  SelfCareClientConfig,
  TenantKindHistoryDBConfig,
  FeatureFlagTenantKindInRiskAnalysisConfig,
  FeatureFlagNewOperatorsConfig,
  FeatureFlagAttributeCertifiedDiscreteConfig,
  FeatureFlagProducerDashboardConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeProcessConfig = CommonHTTPServiceConfig.and(ReadModelSQLDbConfig)
  .and(EventStoreConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(SelfCareClientConfig)
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
  .and(
    z
      .object({
        PRODUCER_DASHBOARD_NEAR_THRESHOLD_PERCENTAGE: z.coerce
          .number()
          .default(80),
      })
      .transform((c) => ({
        producerDashboardNearThresholdPercentage:
          c.PRODUCER_DASHBOARD_NEAR_THRESHOLD_PERCENTAGE,
      }))
  )
  .and(ApplicationAuditProducerConfig)
  .and(FeatureFlagNewOperatorsConfig)
  .and(FeatureFlagAttributeCertifiedDiscreteConfig)
  .and(FeatureFlagProducerDashboardConfig);
type PurposeProcessConfig = z.infer<typeof PurposeProcessConfig>;

export const config: PurposeProcessConfig = PurposeProcessConfig.parse(
  process.env
);
