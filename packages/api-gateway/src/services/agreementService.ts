import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { AgreementProcessClient } from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { toApiGatewayAgreementIfNotDraft } from "../api/agreementApiConverter.js";
import { producerAndConsumerParamMissing } from "../models/errors.js";
import { toAgreementProcessGetAgreementsQueryParams } from "../api/agreementApiConverter.js";

const safeAgreementStates: apiGatewayApi.AgreementState[] = [
  apiGatewayApi.AgreementState.Values.PENDING,
  apiGatewayApi.AgreementState.Values.ACTIVE,
  apiGatewayApi.AgreementState.Values.SUSPENDED,
  apiGatewayApi.AgreementState.Values.ARCHIVED,
  apiGatewayApi.AgreementState.Values.MISSING_CERTIFIED_ATTRIBUTES,
];

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder(
  agreementProcessClient: AgreementProcessClient
) {
  return {
    getAgreements: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      {
        producerId,
        consumerId,
        eserviceId,
        descriptorId,
        states,
      }: apiGatewayApi.GetAgreementsQueryParams
    ): Promise<apiGatewayApi.Agreement[]> => {
      logger.info(
        `Retrieving agreements for producerId ${producerId} consumerId ${consumerId} eServiceId ${eserviceId} descriptorId ${descriptorId} states ${states}`
      );

      if (producerId === undefined && consumerId === undefined) {
        throw producerAndConsumerParamMissing();
      }

      const safeParams = {
        producerId,
        consumerId,
        eserviceId,
        descriptorId,
        states: states && states.length > 0 ? states : safeAgreementStates,
      };

      const agreementApiQueryParams =
        toAgreementProcessGetAgreementsQueryParams(safeParams);

      const getAllAgreementsFrom = async (
        offset: number
      ): Promise<agreementApi.Agreement[]> => {
        const limit = 50;
        const { results: agreements } =
          await agreementProcessClient.getAgreements({
            headers,
            queries: {
              ...agreementApiQueryParams,
              offset,
              limit,
            },
          });
        return agreements.length < limit
          ? agreements
          : agreements.concat(await getAllAgreementsFrom(offset + limit));
      };

      const agreements = await getAllAgreementsFrom(0);
      return agreements.map(toApiGatewayAgreementIfNotDraft);
    },

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
