import {
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import { toM2MGatewayApiRiskAnalysisForm } from "./riskAnalysisFormApiConverter.js";

export function toM2MGatewayEServiceTemplate(
  template: eserviceTemplateApi.EServiceTemplate
): m2mGatewayApiV3.EServiceTemplate {
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
): m2mGatewayApiV3.EServiceTemplateVersion {
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
): m2mGatewayApiV3.EServiceTemplateRiskAnalysis {
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
  params: m2mGatewayApiV3.GetEServiceTemplatesQueryParams
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
): m2mGatewayApiV3.Document {
  return {
    id: document.id,
    name: document.name,
    prettyName: document.prettyName,
    createdAt: document.uploadDate,
    contentType: document.contentType,
  };
}

export function toEServiceTemplateApiEServiceTemplateVersionSeed(
  version: m2mGatewayApiV3.EServiceTemplateVersionSeed
): eserviceTemplateApi.EServiceTemplateVersionSeed {
  return {
    description: version.description,
    voucherLifespan: version.voucherLifespan,
    dailyCallsPerConsumer: version.dailyCallsPerConsumer,
    dailyCallsTotal: version.dailyCallsTotal,
    agreementApprovalPolicy: version.agreementApprovalPolicy,
    attributes: {
      declared: [],
      verified: [],
      certified: [],
    },
    docs: [],
  };
}
