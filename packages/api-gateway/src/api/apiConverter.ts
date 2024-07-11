import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";

export function toApiGatewayAgreement(
  agreement: agreementApi.Agreement
): apiGatewayApi.Agreement {
  return {
    id: agreement.id,
    eserviceId: agreement.eserviceId,
    descriptorId: agreement.descriptorId,
    producerId: agreement.producerId,
    consumerId: agreement.consumerId,
    state: agreement.state,
    // TODO ^ DRAFT state is missing in the API GW spec, but present in all the other specs.
    // This is not compiling. Is it a mistake? Can I fix the API GW spec?
  };
}
