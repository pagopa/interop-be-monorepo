import {
  agreementApi,
  m2mGatewayApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import {
  getPurposeCurrentVersion,
  sortPurposeVersionsByDate,
} from "../services/purposeService.js";

export function toGetPurposesApiQueryParams(
  params: m2mGatewayApi.GetPurposesQueryParams
): purposeApi.GetPurposesQueryParams {
  return {
    eservicesIds: params.eserviceIds,
    limit: params.limit,
    offset: params.offset,
    consumersIds: params.consumerIds,
    producersIds: [],
    states: params.states,
    excludeDraft: false,
    name: params.title,
  };
}

export function toM2MGatewayApiPurpose(
  purpose: purposeApi.Purpose
): m2mGatewayApi.Purpose {
  const currentVersion = getPurposeCurrentVersion(purpose);

  const sortedVersions = sortPurposeVersionsByDate(purpose.versions);

  const waitingForApprovalVersion = sortedVersions.findLast(
    (v) =>
      v.state === m2mGatewayApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL
  );

  const latestVersion = sortedVersions.at(-1);
  const rejectedVersion =
    latestVersion?.state === purposeApi.PurposeVersionState.Values.REJECTED
      ? latestVersion
      : undefined;

  return {
    id: purpose.id,
    eserviceId: purpose.eserviceId,
    consumerId: purpose.consumerId,
    suspendedByConsumer: purpose.suspendedByConsumer,
    suspendedByProducer: purpose.suspendedByProducer,
    title: purpose.title,
    description: purpose.description,
    createdAt: purpose.createdAt,
    updatedAt: purpose.updatedAt,
    isRiskAnalysisValid: purpose.isRiskAnalysisValid,
    isFreeOfCharge: purpose.isFreeOfCharge,
    freeOfChargeReason: purpose.freeOfChargeReason,
    delegationId: purpose.delegationId,
    currentVersion: currentVersion
      ? toM2mGatewayApiPurposeVersion(currentVersion)
      : undefined,
    waitingForApprovalVersion: waitingForApprovalVersion
      ? toM2mGatewayApiPurposeVersion(waitingForApprovalVersion)
      : undefined,
    rejectedVersion: rejectedVersion
      ? toM2mGatewayApiPurposeVersion(rejectedVersion)
      : undefined,
    purposeTemplateId: purpose.purposeTemplateId,
  };
}

export function toM2mGatewayApiPurposeVersion(
  version: purposeApi.PurposeVersion
): m2mGatewayApi.PurposeVersion {
  return {
    id: version.id,
    createdAt: version.createdAt,
    dailyCalls: version.dailyCalls,
    state: version.state,
    firstActivationAt: version.firstActivationAt,
    rejectionReason: version.rejectionReason,
    suspendedAt: version.suspendedAt,
    updatedAt: version.updatedAt,
  };
}

export function toGetAgreementsApiQueryParamsForPurpose(
  purpose: purposeApi.Purpose
): agreementApi.GetAgreementsQueryParams {
  return {
    consumersIds: [purpose.consumerId],
    eservicesIds: [purpose.eserviceId],
    states: [
      m2mGatewayApi.AgreementState.Values.ACTIVE,
      m2mGatewayApi.AgreementState.Values.SUSPENDED,
    ],
    descriptorsIds: [],
    producersIds: [],
    showOnlyUpgradeable: false,
    offset: 0,
    limit: 1,
  };
}
