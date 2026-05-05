import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { toM2MGatewayApiRiskAnalysisForm } from "./riskAnalysisFormApiConverter.js";

export function toGetEServicesQueryParams(
  params: m2mGatewayApiV3.GetEServicesQueryParams
): catalogApi.GetEServicesQueryParams {
  return {
    producersIds: params.producerIds,
    templatesIds: params.templateIds,
    name: params.name,
    technology: params.technology,
    eservicesIds: [],
    attributesIds: [],
    states: [],
    agreementStates: [],
    mode: params.mode,
    isSignalHubEnabled: params.isSignalHubEnabled,
    isConsumerDelegable: params.isConsumerDelegable,
    isClientAccessDelegable: params.isClientAccessDelegable,
    delegated: undefined,
    offset: params.offset,
    limit: params.limit,
  };
}

export function toM2MGatewayApiEService(
  eservice: catalogApi.EService
): m2mGatewayApiV3.EService {
  return {
    id: eservice.id,
    producerId: eservice.producerId,
    name: eservice.name,
    description: eservice.description,
    technology: eservice.technology,
    mode: eservice.mode,
    isSignalHubEnabled: eservice.isSignalHubEnabled,
    isConsumerDelegable: eservice.isConsumerDelegable,
    isClientAccessDelegable: eservice.isClientAccessDelegable,
    templateId: eservice.templateId,
    personalData: eservice.personalData,
  };
}

export function toM2MGatewayApiEServiceDescriptor(
  descriptor: catalogApi.EServiceDescriptor
): m2mGatewayApiV3.EServiceDescriptor {
  return {
    id: descriptor.id,
    version: descriptor.version,
    description: descriptor.description,
    audience: descriptor.audience,
    voucherLifespan: descriptor.voucherLifespan,
    dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
    dailyCallsTotal: descriptor.dailyCallsTotal,
    state: descriptor.state,
    agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
    serverUrls: descriptor.serverUrls,
    publishedAt: descriptor.publishedAt,
    suspendedAt: descriptor.suspendedAt,
    deprecatedAt: descriptor.deprecatedAt,
    archivedAt: descriptor.archivedAt,
    templateVersionId: descriptor.templateVersionRef?.id,
  };
}

export function toCatalogApiEServiceDescriptorSeed(
  descriptor: m2mGatewayApiV3.EServiceDescriptorSeed
): catalogApi.EServiceDescriptorSeed {
  return {
    description: descriptor.description,
    audience: descriptor.audience,
    voucherLifespan: descriptor.voucherLifespan,
    dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
    dailyCallsTotal: descriptor.dailyCallsTotal,
    agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
    attributes: {
      declared: [],
      verified: [],
      certified: [],
    },
    docs: [],
  };
}

export function toCatalogApiPatchUpdateEServiceDescriptorSeed(
  descriptor: m2mGatewayApiV3.EServiceDescriptorDraftUpdateSeed
): catalogApi.PatchUpdateEServiceDescriptorSeed {
  return {
    description: descriptor.description,
    audience: descriptor.audience,
    voucherLifespan: descriptor.voucherLifespan,
    dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
    dailyCallsTotal: descriptor.dailyCallsTotal,
    agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
    attributes: undefined, // Attributes are updated with dedicated API calls
  };
}

export function toM2MGatewayApiEServiceRiskAnalysis(
  riskAnalysis: catalogApi.EServiceRiskAnalysis
): m2mGatewayApiV3.EServiceRiskAnalysis {
  return {
    id: riskAnalysis.id,
    name: riskAnalysis.name,
    createdAt: riskAnalysis.createdAt,
    riskAnalysisForm: toM2MGatewayApiRiskAnalysisForm(
      riskAnalysis.riskAnalysisForm
    ),
  };
}

export function toM2MGatewayApiDocument(
  document: catalogApi.EServiceDoc
): m2mGatewayApiV3.Document {
  return {
    id: document.id,
    name: document.name,
    prettyName: document.prettyName,
    createdAt: document.uploadDate,
    contentType: document.contentType,
  };
}
