import {
  agreementApi,
  m2mGatewayApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import {
  getPurposeCurrentVersion,
  sortPurposeVersionsByDate,
} from "../services/purposeService.js";
import { validateRiskAnalysis } from "pagopa-interop-commons";
import { genericInternalError } from "pagopa-interop-models";
import { M2MGatewayAppContext } from "../utils/context.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { match } from "ts-pattern";

export function toGetPurposesApiQueryParams(
  params: m2mGatewayApi.GetPurposesQueryParams
): purposeApi.GetPurposesQueryParams {
  return {
    eservicesIds: params.eserviceIds,
    limit: params.limit,
    offset: params.offset,
    consumersIds: params.consumerIds,
    producersIds: [],
    clientId: undefined,
    states: params.states,
    excludeDraft: false,
    name: params.title,
  };
}

export function toGetPurposesApiQueryParamsForClient(
  params: {
    clientId: string;
  } & m2mGatewayApi.GetClientPurposesQueryParams
): purposeApi.GetPurposesQueryParams {
  return {
    eservicesIds: params.eserviceIds,
    limit: params.limit,
    offset: params.offset,
    consumersIds: [],
    producersIds: [],
    clientId: params.clientId,
    states: params.states,
    excludeDraft: false,
    name: "",
  };
}

export async function toM2MGatewayApiPurpose(
  purpose: purposeApi.Purpose,
  clients: PagoPAInteropBeClients,
  headers: M2MGatewayAppContext["headers"]
): Promise<m2mGatewayApi.Purpose> {
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

  const isAfterFirstPublication = purpose.versions.some(
    (pv) =>
      pv.state === purposeApi.PurposeVersionState.Values.ACTIVE ||
      pv.state === purposeApi.PurposeVersionState.Values.SUSPENDED
  );

  const isRiskAnalysisValid = await match(isAfterFirstPublication)
    .with(true, () => true)
    .with(false, async () => {
      if (!purpose.riskAnalysisForm) {
        return false;
      }

      const consumer = await clients.tenantProcessClient.tenant.getTenant({
        params: { id: purpose.consumerId },
        headers,
      });

      if (!consumer.data.kind) {
        throw genericInternalError("");
      }

      const eservice = await clients.catalogProcessClient.getEServiceById({
        params: { eServiceId: purpose.eserviceId },
        headers,
      });

      const isRiskAnalysisValid =
        validateRiskAnalysis(
          purpose.riskAnalysisForm,
          false,
          consumer.data.kind,
          new Date(),
          eservice.data.personalData
        ).type === "valid";

      return isRiskAnalysisValid;
    })
    .exhaustive();

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
    isRiskAnalysisValid,
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
    exactConsumerIdMatch: true,
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
