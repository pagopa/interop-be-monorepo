import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";

export function toM2MGatewayApiRiskAnalysisForm(
  riskAnalysisForm: catalogApi.EServiceRiskAnalysisForm
): m2mGatewayApiV3.RiskAnalysisForm {
  return {
    id: riskAnalysisForm.id,
    version: riskAnalysisForm.version,
    answers: riskAnalysisForm.answers,
  };
}
