import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toGetAgreementsApiQueryParams,
  toM2MGatewayApiAgreement,
} from "../api/agreementApiConverter.js";

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder({
  agreementProcessClient,
}: PagoPAInteropBeClients) {
  return {
    getAgreements: async (
      queryParams: m2mGatewayApi.GetAgreementsQueryParams,
      ctx: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreements> => {
      const { producerIds, consumerIds, eserviceIds, states, limit, offset } =
        queryParams;

      ctx.logger.info(
        `Retrieving agreements for producerId ${producerIds} consumerId ${consumerIds} eServiceId ${eserviceIds} states ${states} limit ${limit} offset ${offset}`
      );

      const {
        data: { results, totalCount },
      } = await agreementProcessClient.getAgreements({
        queries: toGetAgreementsApiQueryParams(queryParams),
        headers: ctx.headers,
      });

      return {
        results: results.map(toM2MGatewayApiAgreement),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
  };
}
