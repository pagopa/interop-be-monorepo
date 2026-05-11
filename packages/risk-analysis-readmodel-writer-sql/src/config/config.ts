import {
  RiskAnalysisTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

const RiskAnalysisReadModelWriterConfig =
  ReadModelWriterConfigSQL.and(RiskAnalysisTopicConfig);

type RiskAnalysisReadModelWriterConfig = z.infer<
  typeof RiskAnalysisReadModelWriterConfig
>;

export const config: RiskAnalysisReadModelWriterConfig =
  RiskAnalysisReadModelWriterConfig.parse(process.env);
