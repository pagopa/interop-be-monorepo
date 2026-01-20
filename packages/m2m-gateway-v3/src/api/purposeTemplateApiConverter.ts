import {
  m2mGatewayApiV3,
  purposeTemplateApi,
} from "pagopa-interop-api-clients";

export function toGetPurposeTemplatesApiQueryParams(
  params: m2mGatewayApiV3.GetPurposeTemplatesQueryParams
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

function toPurposeTemplateApiRiskAnalysisTemplateAnswersSeed(
  answers: Record<string, m2mGatewayApiV3.RiskAnalysisTemplateAnswerSeed>
): Record<string, purposeTemplateApi.RiskAnalysisTemplateAnswerSeed> {
  return Object.entries(answers).reduce<
    Record<string, purposeTemplateApi.RiskAnalysisTemplateAnswerSeed>
  >((map, [key, answer]) => {
    if (!answer) {
      return map;
    }
    return {
      ...map,
      [key]: {
        values: answer.values,
        editable: answer.editable,
        suggestedValues: answer.suggestedValues,
        annotation: answer.annotationText
          ? { text: answer.annotationText }
          : undefined,
      } satisfies purposeTemplateApi.RiskAnalysisTemplateAnswerSeed,
    };
  }, {});
}
export function toPurposeTemplateApiRiskAnalysisFormTemplateSeed(
  seed: m2mGatewayApiV3.RiskAnalysisFormTemplateSeed
): purposeTemplateApi.RiskAnalysisFormTemplateSeed {
  return {
    version: seed.version,
    answers: toPurposeTemplateApiRiskAnalysisTemplateAnswersSeed(seed.answers),
  };
}

export function toM2MGatewayApiPurposeTemplate(
  purposeTemplate: purposeTemplateApi.PurposeTemplate
): m2mGatewayApiV3.PurposeTemplate {
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
): m2mGatewayApiV3.RiskAnalysisTemplateAnnotationDocument {
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
): m2mGatewayApiV3.Document {
  return {
    id: document.id,
    name: document.name,
    prettyName: document.prettyName,
    createdAt: document.createdAt,
    contentType: document.contentType,
  };
}
