import { m2mGatewayApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import { tenantKind } from "pagopa-interop-models";
import { match } from "ts-pattern";

export function toGetPurposeTemplatesApiQueryParams(
  params: m2mGatewayApi.GetPurposeTemplatesQueryParams
): purposeTemplateApi.GetPurposeTemplatesQueryParams {
  return {
    purposeTitle: params.purposeTitle,
    creatorIds: params.creatorIds,
    eserviceIds: params.eserviceIds,
    states: params.states,
    targetTenantKind: params.targetTenantKind,
    excludeExpiredRiskAnalysis: false,
    handlesPersonalData: params.handlesPersonalData,
    limit: params.limit,
    offset: params.offset,
  };
}

export function toM2MGatewayApiPurposeTemplate(
  purposeTemplate: purposeTemplateApi.PurposeTemplate
): m2mGatewayApi.PurposeTemplate {
  return {
    id: purposeTemplate.id,
    createdAt: purposeTemplate.createdAt,
    state: purposeTemplate.state,
    purposeTitle: purposeTemplate.purposeTitle,
    targetDescription: purposeTemplate.targetDescription,
    targetTenantKind: toM2MGatewayApiPurposeTemplateTargetTenantKind(
      purposeTemplate.targetTenantKind
    ),
    purposeDescription: purposeTemplate.purposeDescription,
    purposeIsFreeOfCharge: purposeTemplate.purposeIsFreeOfCharge,
    handlesPersonalData: purposeTemplate.handlesPersonalData,
    creatorId: purposeTemplate.creatorId,
    updatedAt: purposeTemplate.updatedAt,
    purposeFreeOfChargeReason: purposeTemplate.purposeFreeOfChargeReason,
    purposeDailyCalls: purposeTemplate.purposeDailyCalls,
  };
}

export function toM2MGatewayApiRiskAnalysisTemplateAnnotationDocument(
  documentWithAnswerId: purposeTemplateApi.RiskAnalysisTemplateAnnotationDocumentWithAnswerId
): m2mGatewayApi.RiskAnalysisTemplateAnnotationDocument {
  return {
    answerId: documentWithAnswerId.answerId,
    document: {
      id: documentWithAnswerId.document.id,
      name: documentWithAnswerId.document.name,
      prettyName: documentWithAnswerId.document.prettyName,
      createdAt: documentWithAnswerId.document.createdAt,
      contentType: documentWithAnswerId.document.contentType,
    },
  };
}

export function toM2MGatewayApiPurposeTemplateTargetTenantKind(
  targetTenantKind: purposeTemplateApi.TenantKind
): m2mGatewayApi.TargetTenantKind {
  return match(targetTenantKind)
    .with(tenantKind.PA, () => m2mGatewayApi.TargetTenantKind.Enum.PA)
    .with(
      tenantKind.SCP,
      tenantKind.GSP,
      tenantKind.PRIVATE,
      () => m2mGatewayApi.TargetTenantKind.Enum.PRIVATE
    )
    .exhaustive();
}
