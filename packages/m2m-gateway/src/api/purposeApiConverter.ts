import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";

export function toM2MPurpose(
  purpose: purposeApi.Purpose
): m2mGatewayApi.Purpose {
  const currentVersion = purpose.versions.at(-1);

  if (!currentVersion) {
    throw new Error("Current purpose has no versions");
  }

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
    waitingForApprovalVersion: purpose.versions.findLast(
      (version) => version.state === "WAITING_FOR_APPROVAL"
    ),
    rejectedVersion: purpose.versions.findLast(
      (version) => version.state === "REJECTED"
    ),
  };
}
