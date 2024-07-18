import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { assertAgreementStateNotDraft } from "../services/validators.js";

export function toApiGatewayAgreementIfNotDraft(
  agreement: agreementApi.Agreement
): apiGatewayApi.Agreement {
  assertAgreementStateNotDraft(agreement.state, agreement.id);

  return {
    id: agreement.id,
    eserviceId: agreement.eserviceId,
    descriptorId: agreement.descriptorId,
    producerId: agreement.producerId,
    consumerId: agreement.consumerId,
    state: agreement.state,
  };
}

export function toAgreementProcessGetAgreementsQueryParams(
  queryParams: apiGatewayApi.GetAgreementsQueryParams
): Omit<agreementApi.GetAgreementsQueryParams, "offset" | "limit"> {
  const { producerId, consumerId, eserviceId, descriptorId, states } =
    queryParams;

  return {
    producersIds: producerId ? [producerId] : [],
    consumersIds: consumerId ? [consumerId] : [],
    eservicesIds: eserviceId ? [eserviceId] : [],
    descriptorsIds: descriptorId ? [descriptorId] : [],
    states,
    showOnlyUpgradeable: false,
  };
}
