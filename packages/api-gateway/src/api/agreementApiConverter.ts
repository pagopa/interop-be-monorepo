import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { Logger } from "pagopa-interop-commons";
import { assertAgreementStateNotDraft } from "../services/validators.js";

const allowedAgreementStates: apiGatewayApi.AgreementState[] = [
  apiGatewayApi.AgreementState.Values.PENDING,
  apiGatewayApi.AgreementState.Values.ACTIVE,
  apiGatewayApi.AgreementState.Values.SUSPENDED,
  apiGatewayApi.AgreementState.Values.ARCHIVED,
  apiGatewayApi.AgreementState.Values.MISSING_CERTIFIED_ATTRIBUTES,
];

export function toApiGatewayAgreementIfNotDraft(
  agreement: agreementApi.Agreement,
  logger: Logger
): apiGatewayApi.Agreement {
  assertAgreementStateNotDraft(agreement.state, agreement.id, logger);

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
    showOnlyUpgradeable: false,
    states: states && states.length > 0 ? states : allowedAgreementStates,
  };
}
