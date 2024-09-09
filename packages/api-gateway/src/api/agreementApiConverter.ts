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
