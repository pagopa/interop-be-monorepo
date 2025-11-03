import { m2mGatewayApi, purposeTemplateApi } from "pagopa-interop-api-clients";

export function toM2MGatewayApiPurposeTemplate(
  purposeTemplate: purposeTemplateApi.PurposeTemplate
): m2mGatewayApi.PurposeTemplate {
  return {
    id: purposeTemplate.id,
    createdAt: purposeTemplate.createdAt,
    state: purposeTemplate.state,
    purposeTitle: purposeTemplate.purposeTitle,
    targetDescription: purposeTemplate.targetDescription,
    targetTenantKind: purposeTemplate.targetTenantKind,
    purposeDescription: purposeTemplate.purposeDescription,
    purposeIsFreeOfCharge: purposeTemplate.purposeIsFreeOfCharge,
    handlesPersonalData: purposeTemplate.handlesPersonalData,
    creatorId: purposeTemplate.creatorId,
    updatedAt: purposeTemplate.updatedAt,
    purposeFreeOfChargeReason: purposeTemplate.purposeFreeOfChargeReason,
    purposeDailyCalls: purposeTemplate.purposeDailyCalls,
  };
}
