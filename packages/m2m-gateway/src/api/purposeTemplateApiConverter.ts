import { eserviceTemplateApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { toM2MGatewayApiRiskAnalysisForm } from "./riskAnalysisFormApiConverter.js";

export function toM2MGatewayEServiceTemplate(
  template: eserviceTemplateApi.EServiceTemplate
): m2mGatewayApi.EServiceTemplate {
  return {
    id: template.id,
    creatorId: template.creatorId,
    description: template.description,
    intendedTarget: template.intendedTarget,
    mode: template.mode,
    name: template.name,
    technology: template.technology,
    isSignalHubEnabled: template.isSignalHubEnabled,
    personalData: template.personalData,
  };
}

export function toM2MGatewayEServiceTemplateVersion(
  version: eserviceTemplateApi.EServiceTemplateVersion
): m2mGatewayApi.EServiceTemplateVersion {
  return {
    id: version.id,
    state: version.state,
    version: version.version,
    voucherLifespan: version.voucherLifespan,
    agreementApprovalPolicy: version.agreementApprovalPolicy,
    dailyCallsPerConsumer: version.dailyCallsPerConsumer,
    dailyCallsTotal: version.dailyCallsTotal,
    deprecatedAt: version.deprecatedAt,
    description: version.description,
    publishedAt: version.publishedAt,
    suspendedAt: version.suspendedAt,
  };
}

export function toM2MGatewayApiEServiceTemplateRiskAnalysis(
  riskAnalysis: eserviceTemplateApi.EServiceTemplateRiskAnalysis
): m2mGatewayApi.EServiceTemplateRiskAnalysis {
  return {
    id: riskAnalysis.id,
    name: riskAnalysis.name,
    createdAt: riskAnalysis.createdAt,
    riskAnalysisForm: toM2MGatewayApiRiskAnalysisForm(
      riskAnalysis.riskAnalysisForm
    ),
    tenantKind: riskAnalysis.tenantKind,
  };
}

export function toGetEServiceTemplatesQueryParams(
  params: m2mGatewayApi.GetEServiceTemplatesQueryParams
): eserviceTemplateApi.GetEServiceTemplatesQueryParams {
  return {
    eserviceTemplatesIds: params.eserviceTemplateIds,
    creatorsIds: params.creatorIds,
    states: [],
    offset: params.offset,
    limit: params.limit,
  };
}

export function toM2MGatewayApiDocument(
  document: eserviceTemplateApi.EServiceDoc
): m2mGatewayApi.Document {
  return {
    id: document.id,
    name: document.name,
    prettyName: document.prettyName,
    createdAt: document.uploadDate,
    contentType: document.contentType,
  };
}
