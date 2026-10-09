import {
  CatalogProcessServerConfig,
  EServiceTemplateProcessServerConfig,
  LoggerConfig,
  PurposeProcessServerConfig,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const RiskAnalysisProcessingJobConfig = LoggerConfig.and(ReadModelSQLDbConfig)
  .and(TokenGenerationConfig)
  .and(CatalogProcessServerConfig)
  .and(PurposeProcessServerConfig)
  .and(EServiceTemplateProcessServerConfig)
  .and(
    z
      .object({
        FIX_LIST_TENANT_KIND_RISK_ANALYSIS_ESERVICE_TEMPLATES: z
          .string()
          .transform((value) =>
            value
              .split(",")
              .map((v) => v.trim())
              .filter((v) => v)
          )
          .optional(),
      })
      .transform((c) => ({
        fixListTenantKindRiskAnalysisEserviceTemplates:
          c.FIX_LIST_TENANT_KIND_RISK_ANALYSIS_ESERVICE_TEMPLATES,
      }))
  );

type RiskAnalysisProcessingJobConfig = z.infer<
  typeof RiskAnalysisProcessingJobConfig
>;

export const config: RiskAnalysisProcessingJobConfig =
  RiskAnalysisProcessingJobConfig.parse(process.env);
