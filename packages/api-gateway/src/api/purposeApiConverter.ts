import { apiGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { assertActivePurposeVersionExixsts } from "../services/validators.js";

const allowedPurposeStates: apiGatewayApi.PurposeState[] = [
  apiGatewayApi.PurposeState.Values.ACTIVE,
  apiGatewayApi.PurposeState.Values.SUSPENDED,
];

export function toPurposeProcessGetPurposesQueryParams(
  queryParams: apiGatewayApi.GetPurposesQueryParams
): Omit<purposeApi.GetPurposesQueryParams, "offset" | "limit"> {
  const { eserviceId, consumerId } = queryParams;

  return {
    producersIds: [],
    consumersIds: consumerId ? [consumerId] : [],
    eservicesIds: eserviceId ? [eserviceId] : [],
    states: allowedPurposeStates,
    excludeDraft: false,
  };
}

export function toApiGatewayPurpose(
  purpose: purposeApi.Purpose
): apiGatewayApi.Purpose {
  const activePurposeVersion = [...purpose.versions]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .find((v) => allowedPurposeStates.includes(v.state));

  assertActivePurposeVersionExixsts(activePurposeVersion, purpose.id);

  return {
    id: purpose.id,
    throughput: activePurposeVersion.dailyCalls,
    state: activePurposeVersion.state,
  };
}
