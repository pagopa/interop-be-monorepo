import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { AgreementProcessClient } from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { toApiGatewayAgreementIfNotDraft } from "../api/agreementApiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder(
  agreementProcessClient: AgreementProcessClient
) {
  return {
    getAgreementById: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      agreementId: agreementApi.Agreement["id"]
    ): Promise<apiGatewayApi.Agreement> => {
      logger.info(`Retrieving agreement by id = ${agreementId}`);
      const agreement = await agreementProcessClient.getAgreementById({
        headers,
        params: {
          agreementId,
        },
      });

      return toApiGatewayAgreementIfNotDraft(agreement);
    },
  };
}
