import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { RiskAnalysisFormTemplate, tenantKind } from "pagopa-interop-models";
import { riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate } from "pagopa-interop-commons";
import { getMockValidRiskAnalysisFormTemplate } from "pagopa-interop-commons-test";

export const buildRiskAnalysisFormTemplateSeed = (
  riskAnalysisFormTemplate: RiskAnalysisFormTemplate
): purposeTemplateApi.RiskAnalysisFormTemplateSeed =>
  riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate(
    riskAnalysisFormTemplate
  );

export const getMockPurposeTemplateSeed = (
  riskAnalysisFormTemplate: purposeTemplateApi.RiskAnalysisFormTemplateSeed = buildRiskAnalysisFormTemplateSeed(
    getMockValidRiskAnalysisFormTemplate(tenantKind.PA)
  ),
  targetTenantKind: purposeTemplateApi.TenantKind = tenantKind.PA
): purposeTemplateApi.PurposeTemplateSeed => ({
  targetDescription: "Test target description",
  targetTenantKind,
  purposeTitle: "Test purpose title",
  purposeDescription: "Test purpose description",
  purposeRiskAnalysisForm: riskAnalysisFormTemplate,
  purposeIsFreeOfCharge: true,
  purposeFreeOfChargeReason: "Test reason",
  purposeDailyCalls: 10,
});
