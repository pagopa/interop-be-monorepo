import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { Logger } from "pagopa-interop-commons";
import { ApiError } from "pagopa-interop-models";
import { assertActivePurposeVersionExists } from "../validators/purposeValidator.js";
import { purposeNotFound } from "../model/errors.js";

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

export function toM2MGatewayApiPurpose({
  purpose,
  logger,
  throwNotFoundError = false,
}: {
  purpose: purposeApi.Purpose;
  logger: Logger;
  throwNotFoundError?: boolean;
}): m2mGatewayApi.Purpose {
  try {
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

    assertActivePurposeVersionExists(currentVersion, purpose.id);

    const waitingForApprovalVersion = purpose.versions.find(
      (v) =>
        v.state ===
        m2mGatewayApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL
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
  } catch (error) {
    if (throwNotFoundError) {
      logger.warn(
        `Root cause for "purposeNotFound" error: unexpected error while converting attribute: ${
          error instanceof ApiError ? error.detail : error
        }`
      );

      throw purposeNotFound(purpose.id);
    } else {
      throw error;
    }
  }
}
