/* eslint-disable functional/immutable-data */
import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { AgreementProcessClient } from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { toApiGatewayAgreement } from "../api/apiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder(
  agreementProcessClient: AgreementProcessClient
) {
  return {
    getAgreementById: async (
      context: WithLogger<ApiGatewayAppContext>,
      agreementId: string
    ): Promise<apiGatewayApi.Agreement> => {
      context.logger.info(`Retrieving agreement by id = ${agreementId}`);
      const result: agreementApi.Agreement =
        await agreementProcessClient.getAgreementById({
          headers: context.headers,
          params: {
            agreementId,
          },
        });
      return toApiGatewayAgreement(result);
    },
  };
}
