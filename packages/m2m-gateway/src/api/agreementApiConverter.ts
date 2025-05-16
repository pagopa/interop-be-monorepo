import { agreementApi, m2mGatewayApi } from "pagopa-interop-api-clients";

export function toM2MGatewayApiAgreement(
  agreement: agreementApi.Agreement
): m2mGatewayApi.Agreement {
  return {
    id: agreement.id,
    eserviceId: agreement.eserviceId,
    descriptorId: agreement.descriptorId,
    producerId: agreement.producerId,
    consumerId: agreement.consumerId,
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
    descriptorsIds: [],
    showOnlyUpgradeable: false,
    states: params.states,
    limit: params.limit,
    offset: params.offset,
  };
}
