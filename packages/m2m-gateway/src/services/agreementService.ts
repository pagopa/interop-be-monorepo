import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { AgreementId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { toM2MAgreement } from "../api/agreementApiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder({
  agreementProcessClient,
}: PagoPAInteropBeClients) {
  return {
    getAgreements: async (
      ctx: WithLogger<M2MGatewayAppContext>,
      queryParams: m2mGatewayApi.GetAgreementsQueryParams
    ): Promise<m2mGatewayApi.Agreements> => {
      const { producerIds, consumerIds, eserviceIds, states, limit, offset } =
        queryParams;

      ctx.logger.info(
        `Retrieving agreements for producerId ${producerIds} consumerId ${consumerIds} eServiceId ${eserviceIds} states ${states} limit ${limit} offset ${offset}`
      );

      const { results, totalCount } =
        await agreementProcessClient.getAgreements({
          queries: {
            consumersIds: consumerIds,
            producersIds: producerIds,
            eservicesIds: eserviceIds,
            states,
            limit,
            offset,
          },
          headers: ctx.headers,
        });

      return {
        results: results.map(toM2MAgreement),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    getAgreement: async (
      ctx: WithLogger<M2MGatewayAppContext>,
      agreementId: AgreementId
    ): Promise<m2mGatewayApi.Agreement> => {
      ctx.logger.info(`Retrieving agreement with id ${agreementId}`);

      const { data: agreement } = await agreementProcessClient.getAgreementById(
        {
          params: {
            agreementId,
          },
          headers: ctx.headers,
        }
      );

      return toM2MAgreement(agreement);
    },
  };
}
