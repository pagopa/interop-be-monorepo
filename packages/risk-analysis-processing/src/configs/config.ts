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
        PURPOSE_PROCESS_URL: z.string(),
      })
      .transform((c) => ({
        purposeProcessUrl: c.PURPOSE_PROCESS_URL,
      }))
  );

type RiskAnalysisProcessingJobConfig = z.infer<
  typeof RiskAnalysisProcessingJobConfig
>;

export const config: RiskAnalysisProcessingJobConfig =
  RiskAnalysisProcessingJobConfig.parse(process.env);
