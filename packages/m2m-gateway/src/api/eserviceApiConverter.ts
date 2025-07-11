import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";

export function toGetEServicesQueryParams(
  params: m2mGatewayApi.GetEServicesQueryParams
): catalogApi.GetEServicesQueryParams {
  return {
    producersIds: params.producerIds,
    templatesIds: params.templateIds,
    name: params.name,
    // technology: params.technology, // TODO: Add
    eservicesIds: [],
    attributesIds: [],
    states: [],
    agreementStates: [],
    mode: params.mode,
    // isSignalHubEnabled: params.isSignalHubEnabled, // TODO: Add
    isConsumerDelegable: params.isConsumerDelegable,
    // isClientAccessDelegable: params.isClientAccessDelegable, // TODO: Add
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
