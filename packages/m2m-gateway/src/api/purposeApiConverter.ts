import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";

export function toM2MPurpose(
  purpose: purposeApi.Purpose
): m2mGatewayApi.Purpose {
  const statesToExclude: m2mGatewayApi.PurposeVersionState[] = [
    m2mGatewayApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL,
    m2mGatewayApi.PurposeVersionState.Values.REJECTED,
  ];
  const currentVersion = purpose.versions
    .filter((v) => !statesToExclude.includes(v.state))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .at(-1);

  if (!currentVersion) {
    throw new Error("Current purpose has no versions");
  }

  const waitingForApprovalVersion = purpose.versions.find(
    (v) =>
      v.state === m2mGatewayApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL
  );
  const rejectedVersion = purpose.versions.find(
    (v) => v.state === m2mGatewayApi.PurposeVersionState.Values.REJECTED
  );

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

export function toM2MPurposeVersion(
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
