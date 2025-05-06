import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PurposeId } from "pagopa-interop-models";
import {
  toGetPurposesApiQueryParams,
  toM2MGatewayApiPurpose,
} from "../api/purposeApiConverter.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";

export type PurposeService = ReturnType<typeof purposeServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    getPurposes: async (
      queryParams: m2mGatewayApi.GetPurposesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purposes> => {
      const { eserviceIds, limit, offset } = queryParams;

      logger.info(
        `Retrieving purposes for eServiceIds ${eserviceIds} limit ${limit} offset ${offset}`
      );

      const queries = toGetPurposesApiQueryParams(queryParams);

      const {
        data: { results, totalCount },
      } = await clients.purposeProcessClient.getPurposes({ queries, headers });

      return {
        results: results.map(toM2MGatewayApiPurpose),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    getPurpose: async (
      purposeId: PurposeId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purpose> => {
      logger.info(`Retrieving purpose with id ${purposeId}`);

      const { data } = await clients.purposeProcessClient.getPurpose({
        params: {
          id: purposeId,
        },
        headers,
      });

      return toM2MGatewayApiPurpose(data);
    },
  };
}
