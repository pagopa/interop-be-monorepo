import { m2mGatewayApi, purposeTemplateApi } from "pagopa-interop-api-clients";

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

export function toM2MGatewayApiDocument(
  document: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocument
): m2mGatewayApi.Document {
  return {
    id: document.id,
    name: document.name,
    prettyName: document.prettyName,
    createdAt: document.createdAt,
    contentType: document.contentType,
  };
}
