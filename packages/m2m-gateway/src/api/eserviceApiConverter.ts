import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";

export function toGetEServicesQueryParams(
  params: m2mGatewayApi.GetEServicesQueryParams
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
): m2mGatewayApi.EService {
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
  };
}

export function toM2MGatewayApiEServiceDescriptor(
  descriptor: catalogApi.EServiceDescriptor
): m2mGatewayApi.EServiceDescriptor {
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

export function toM2MGatewayApiDocument(
  document: catalogApi.EServiceDoc
): m2mGatewayApi.Document {
  return {
    id: document.id,
    name: document.name,
    prettyName: document.prettyName,
    createdAt: document.uploadDate,
    contentType: document.contentType,
  };
}

export function toCatalogApiEServiceDescriptorSeed(
  descriptor: m2mGatewayApi.EServiceDescriptorSeed
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

export function toM2MGatewayApiRiskAnalysisAnswers(
  singleAnswers: catalogApi.EServiceRiskAnalysisSingleAnswer[],
  multiAnswers: catalogApi.EServiceRiskAnalysisMultiAnswer[]
): Record<string, string[]> {
  const singleAnswersMap = singleAnswers.reduce<Record<string, string[]>>(
    (map, { key, value }) => {
      if (!value) {
        return map;
      }
      // eslint-disable-next-line functional/immutable-data
      map[key] = [value];
      return map;
    },
    {}
  );

  const multiAnswersMap = multiAnswers.reduce<Record<string, string[]>>(
    (map, { key, values }) => {
      if (values.length === 0) {
        return map;
      }
      // eslint-disable-next-line functional/immutable-data
      map[key] = values;
      return map;
    },
    {}
  );

  return {
    ...singleAnswersMap,
    ...multiAnswersMap,
  };
}

export function toM2MGatewayApiRiskAnalysisForm(
  riskAnalysisForm: catalogApi.EServiceRiskAnalysisForm
): m2mGatewayApi.RiskAnalysisForm {
  return {
    id: riskAnalysisForm.id,
    version: riskAnalysisForm.version,
    answers: toM2MGatewayApiRiskAnalysisAnswers(
      riskAnalysisForm.singleAnswers,
      riskAnalysisForm.multiAnswers
    ),
  };
}

export function toM2MGatewayApiEServiceRiskAnalysis(
  riskAnalysis: catalogApi.EServiceRiskAnalysis
): m2mGatewayApi.EServiceRiskAnalysis {
  return {
    id: riskAnalysis.id,
    name: riskAnalysis.name,
    createdAt: riskAnalysis.createdAt,
    riskAnalysisForm: toM2MGatewayApiRiskAnalysisForm(
      riskAnalysis.riskAnalysisForm
    ),
  };
}
