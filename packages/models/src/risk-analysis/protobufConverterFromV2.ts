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
import { bigIntToDate, unsafeBrandId } from "../utils.js";
import { TenantKind } from "../tenant/tenant.js";

export const fromRiskAnalysisContextV2 = (
  input: RiskAnalysisContextV2
): RiskAnalysisContext =>
  match(input)
    .with(
      RiskAnalysisContextV2.ESERVICE,
      () => riskAnalysisContext.eservice as RiskAnalysisContext
    )
    .with(
      RiskAnalysisContextV2.ESERVICE_TEMPLATE,
      () => riskAnalysisContext.eserviceTemplate as RiskAnalysisContext
    )
    .otherwise(() => {
      throw new Error(
        `Unknown RiskAnalysisContextV2 value: ${input}`
      );
    });

export const fromRiskAnalysisSingleAnswerV2 = (
  input: RiskAnalysisSingleAnswerV2
): RiskAnalysisSingleAnswer => ({
  ...input,
  id: unsafeBrandId(input.id),
});

export const fromRiskAnalysisMultiAnswerV2 = (
  input: RiskAnalysisMultiAnswerV2
): RiskAnalysisMultiAnswer => ({
  ...input,
  id: unsafeBrandId(input.id),
});

export const fromStandaloneRiskAnalysisFormV2 = (
  input: RiskAnalysisFormV2 | undefined
): RiskAnalysisForm => {
  if (!input) {
    throw new Error(
      "riskAnalysisForm field is required in StandaloneRiskAnalysis but is not provided in serialized byte array events"
    );
  }

  return {
    id: unsafeBrandId(input.id),
    version: input.version,
    singleAnswers: input.singleAnswers.map(fromRiskAnalysisSingleAnswerV2),
    multiAnswers: input.multiAnswers.map(fromRiskAnalysisMultiAnswerV2),
  };
};

export const fromStandaloneRiskAnalysisV2 = (
  input: RiskAnalysisV2
): StandaloneRiskAnalysis => ({
  id: unsafeBrandId(input.id),
  name: input.name,
  context: fromRiskAnalysisContextV2(input.context),
  eserviceId: input.eserviceId != null ? unsafeBrandId(input.eserviceId) : undefined,
  templateId: input.templateId != null ? unsafeBrandId(input.templateId) : undefined,
  tenantKind: input.tenantKind != null ? (input.tenantKind as TenantKind) : undefined,
  riskAnalysisForm: fromStandaloneRiskAnalysisFormV2(input.riskAnalysisForm),
  createdAt: bigIntToDate(input.createdAt),
});
