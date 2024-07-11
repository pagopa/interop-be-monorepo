/* eslint-disable functional/immutable-data */
import { apiGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { AgreementProcessClient } from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder(
  agreementProcessClient: AgreementProcessClient
) {
  return {
    getAgreementById: async (
      context: WithLogger<ApiGatewayAppContext>,
      agreementId: string
      // TODO ^ should be agreementApi.GetAgreementByIdQueryParam but it's not working
    ): Promise<apiGatewayApi.GetAgreementQueryParam> => {
      context.logger.info(`Retrieving agreement by id = ${agreementId}`);
      return await agreementProcessClient.getAgreementById({
        headers: context.headers,
        params: {
          agreementId,
        },
      });
    },
  };
}
