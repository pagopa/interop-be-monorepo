import {
  agreementApi,
  delegationApi,
  m2mGatewayApi,
  purposeApi,
} from "pagopa-interop-api-clients";

export function toM2MGatewayApiAgreement(
  agreement: agreementApi.Agreement,
  delegationId: delegationApi.Delegation["id"] | undefined
): m2mGatewayApi.Agreement {
  return {
    id: agreement.id,
    eserviceId: agreement.eserviceId,
    descriptorId: agreement.descriptorId,
    producerId: agreement.producerId,
    consumerId: agreement.consumerId,
    delegationId,
    state: agreement.state,
    suspendedByConsumer: agreement.suspendedByConsumer,
    suspendedByProducer: agreement.suspendedByProducer,
    suspendedByPlatform: agreement.suspendedByPlatform,
    consumerNotes: agreement.consumerNotes,
    rejectionReason: agreement.rejectionReason,
    createdAt: agreement.createdAt,
    updatedAt: agreement.updatedAt,
    suspendedAt: agreement.suspendedAt,
  };
}

export function toGetAgreementsApiQueryParams(
  params: m2mGatewayApi.GetAgreementsQueryParams
): agreementApi.GetAgreementsQueryParams {
  return {
    consumersIds: params.consumerIds,
    producersIds: params.producerIds,
    eservicesIds: params.eserviceIds,
    descriptorsIds: params.descriptorIds,
    showOnlyUpgradeable: false,
    states: params.states,
    limit: params.limit,
    offset: params.offset,
  };
}

export function toGetPurposesApiQueryParamsForAgreement(
  agreement: agreementApi.Agreement,
  params: m2mGatewayApi.GetAgreementPurposesQueryParams
): purposeApi.GetPurposesQueryParams {
  return {
    limit: params.limit,
    offset: params.offset,
    eservicesIds: [agreement.eserviceId],
    consumersIds: [agreement.consumerId],
    producersIds: [],
    purposesIds: [],
    states: [],
    excludeDraft: false,
    name: undefined,
  };
}

export function toM2MGatewayApiDocument(
  document: agreementApi.Document
): m2mGatewayApi.Document {
  return {
    id: document.id,
    name: document.name,
    prettyName: document.prettyName,
    createdAt: document.createdAt,
    contentType: document.contentType,
  };
}
