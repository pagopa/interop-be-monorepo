import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";

export function toGetPurposesApiQueryParams(
  params: m2mGatewayApi.GetPurposesQueryParams
): purposeApi.GetPurposesQueryParams {
  return {
    eservicesIds: params.eserviceIds,
    limit: params.limit,
    offset: params.offset,
    consumersIds: [],
    producersIds: [],
    states: [],
    excludeDraft: false,
    name: undefined,
  };
}

export function toM2MGatewayApiPurpose(
  purpose: purposeApi.Purpose
): m2mGatewayApi.Purpose {
  const sortedVersions = [...purpose.versions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const statesToExclude: m2mGatewayApi.PurposeVersionState[] = [
    m2mGatewayApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL,
    m2mGatewayApi.PurposeVersionState.Values.REJECTED,
  ];
  const currentVersion = sortedVersions.findLast(
    (v) => !statesToExclude.includes(v.state)
  );

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
    currentVersion,
    waitingForApprovalVersion,
    rejectedVersion,
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
