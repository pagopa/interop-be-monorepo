import {
  LoggerConfig,
  PurposeProcessServerConfig,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const RiskAnalysisProcessingJobConfig = LoggerConfig.and(ReadModelSQLDbConfig)
  .and(TokenGenerationConfig)
  .and(PurposeProcessServerConfig);

type RiskAnalysisProcessingJobConfig = z.infer<
  typeof RiskAnalysisProcessingJobConfig
>;

export const config: RiskAnalysisProcessingJobConfig =
  RiskAnalysisProcessingJobConfig.parse(process.env);
