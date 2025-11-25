import { m2mGatewayApi, purposeTemplateApi } from "pagopa-interop-api-clients";

export function toM2MGatewayApiRiskAnalysisFormTemplate(
  riskAnalysisForm: purposeTemplateApi.RiskAnalysisFormTemplate
): m2mGatewayApi.RiskAnalysisFormTemplate {
  return {
    version: riskAnalysisForm.version,
    answers: toM2MGatewayApiRiskAnalysisTemplateAnswers(
      riskAnalysisForm.answers
    ),
  };
}

export function toM2MGatewayApiRiskAnalysisTemplateAnswers(
  answers: Record<string, purposeTemplateApi.RiskAnalysisTemplateAnswer>
): Record<string, m2mGatewayApi.RiskAnalysisTemplateAnswer> {
  return Object.entries(answers).reduce<
    Record<string, m2mGatewayApi.RiskAnalysisTemplateAnswer>
  >(
    (
      map,
      [key, answer]
    ): Record<string, m2mGatewayApi.RiskAnalysisTemplateAnswer> => {
      if (!answer) {
        return map;
      }
      return {
        ...map,
        [key]: {
          id: answer.id,
          values: answer.values,
          editable: answer.editable,
          annotationText: answer.annotation
            ? answer.annotation.text
            : undefined,
          suggestedValues: answer.suggestedValues,
        } satisfies m2mGatewayApi.RiskAnalysisTemplateAnswer,
      };
    },
    {}
  );
}
