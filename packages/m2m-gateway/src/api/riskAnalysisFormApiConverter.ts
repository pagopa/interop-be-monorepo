import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";

export function toM2MGatewayApiRiskAnalysisForm(
  riskAnalysisForm: catalogApi.EServiceRiskAnalysisForm
): m2mGatewayApi.RiskAnalysisForm {
  return {
    id: riskAnalysisForm.id,
    version: riskAnalysisForm.version,
    answers: riskAnalysisForm.answers,
  };
}
