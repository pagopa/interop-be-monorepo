import { match } from "ts-pattern";
import {
  RiskAnalysisContextV2,
  RiskAnalysisFormV2,
  RiskAnalysisMultiAnswerV2,
  RiskAnalysisSingleAnswerV2,
  RiskAnalysisV2,
} from "../gen/v2/risk-analysis/risk-analysis.js";
import {
  RiskAnalysisContext,
  RiskAnalysisForm,
  RiskAnalysisMultiAnswer,
  RiskAnalysisSingleAnswer,
  StandaloneRiskAnalysis,
  riskAnalysisContext,
} from "./riskAnalysis.js";
import { dateToBigInt } from "../utils.js";

export const toRiskAnalysisContextV2 = (
  input: RiskAnalysisContext
): RiskAnalysisContextV2 =>
  match(input)
    .with(riskAnalysisContext.eservice, () => RiskAnalysisContextV2.ESERVICE)
    .with(
      riskAnalysisContext.eserviceTemplate,
      () => RiskAnalysisContextV2.ESERVICE_TEMPLATE
    )
    .exhaustive();

export const toRiskAnalysisSingleAnswerV2 = (
  input: RiskAnalysisSingleAnswer
): RiskAnalysisSingleAnswerV2 => ({
  ...input,
});

export const toRiskAnalysisMultiAnswerV2 = (
  input: RiskAnalysisMultiAnswer
): RiskAnalysisMultiAnswerV2 => ({
  ...input,
});

export const toRiskAnalysisFormV2 = (
  input: RiskAnalysisForm
): RiskAnalysisFormV2 => ({
  ...input,
  singleAnswers: input.singleAnswers.map(toRiskAnalysisSingleAnswerV2),
  multiAnswers: input.multiAnswers.map(toRiskAnalysisMultiAnswerV2),
});

export const toStandaloneRiskAnalysisV2 = (
  input: StandaloneRiskAnalysis
): RiskAnalysisV2 => ({
  id: input.id,
  name: input.name,
  context: toRiskAnalysisContextV2(input.context),
  eserviceId: input.eserviceId,
  templateId: input.templateId,
  tenantKind: input.tenantKind,
  riskAnalysisForm: toRiskAnalysisFormV2(input.riskAnalysisForm),
  createdAt: dateToBigInt(input.createdAt),
});
