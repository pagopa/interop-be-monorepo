import {
  catalogApi,
  m2mGatewayApi,
  eserviceTemplateApi,
} from "pagopa-interop-api-clients";

export function toM2MGatewayApiRiskAnalysisForm(
  riskAnalysisForm: catalogApi.EServiceRiskAnalysisForm
): m2mGatewayApi.RiskAnalysisForm {
  return {
    id: riskAnalysisForm.id,
    version: riskAnalysisForm.version,
    answers: toM2MGatewayApiRiskAnalysisAnswers(
      riskAnalysisForm.singleAnswers,
      riskAnalysisForm.multiAnswers
    ),
  };
}

export function toM2MGatewayApiRiskAnalysisAnswers(
  singleAnswers: eserviceTemplateApi.EServiceRiskAnalysisSingleAnswer[],
  multiAnswers: eserviceTemplateApi.EServiceRiskAnalysisMultiAnswer[]
): Record<string, string[]> {
  const singleAnswersMap = singleAnswers.reduce<Record<string, string[]>>(
    (map, { key, value }) => {
      if (!value) {
        return map;
      }
      return { ...map, [key]: [value] };
    },
    {}
  );

  const multiAnswersMap = multiAnswers.reduce<Record<string, string[]>>(
    (map, { key, values }) => {
      if (values.length === 0) {
        return map;
      }
      return { ...map, [key]: values };
    },
    {}
  );

  return {
    ...singleAnswersMap,
    ...multiAnswersMap,
  };
}
