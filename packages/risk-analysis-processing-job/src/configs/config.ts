import {
  LoggerConfig,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const RiskAnalysisProcessingJobConfig = LoggerConfig.and(ReadModelSQLDbConfig)
  .and(TokenGenerationConfig)
  .and(
    z
      .object({
        CATALOG_PROCESS_URL: z.string(),
        PURPOSE_PROCESS_URL: z.string(),
        ESERVICE_TEMPLATE_PROCESS_URL: z.string(),
        FIX_LIST_TENANT_KIND_RISK_ANALYSIS_ESERVICE_TEMPLATES: z
          .string()
          .transform((value) => value.split(","))
          .optional(),
      })
      .transform((c) => ({
        catalogProcessUrl: c.CATALOG_PROCESS_URL,
        purposeProcessUrl: c.PURPOSE_PROCESS_URL,
        eserviceTemplateProcessUrl: c.ESERVICE_TEMPLATE_PROCESS_URL,
        fixListTenantKindRiskAnalysisEserviceTemplates:
          c.FIX_LIST_TENANT_KIND_RISK_ANALYSIS_ESERVICE_TEMPLATES,
      }))
  );

type RiskAnalysisProcessingJobConfig = z.infer<
  typeof RiskAnalysisProcessingJobConfig
>;

export const config: RiskAnalysisProcessingJobConfig =
  RiskAnalysisProcessingJobConfig.parse(process.env);
