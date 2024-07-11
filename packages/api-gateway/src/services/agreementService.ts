/* eslint-disable functional/immutable-data */
import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { AgreementProcessClient } from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { assertAgreementStateNotDraft } from "./validators.js";

function toApiGatewayAgreementIfNotDraft(
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder(
  agreementProcessClient: AgreementProcessClient
) {
  return {
    getAgreementById: async (
      context: WithLogger<ApiGatewayAppContext>,
      agreementId: agreementApi.Agreement["id"]
    ): Promise<apiGatewayApi.Agreement> => {
      context.logger.info(`Retrieving agreement by id = ${agreementId}`);
      const agreement: agreementApi.Agreement =
        await agreementProcessClient.getAgreementById({
          headers: context.headers,
          params: {
            agreementId,
          },
        });

      return toApiGatewayAgreementIfNotDraft(agreement);
    },
  };
}
