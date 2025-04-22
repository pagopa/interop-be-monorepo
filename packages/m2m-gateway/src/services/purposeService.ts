import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PurposeId } from "pagopa-interop-models";
import { toM2MPurpose } from "../api/purposeApiConverter.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder({
  purposeProcessClient,
}: PagoPAInteropBeClients) {
  return {
    getPurposes: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      queryParams: m2mGatewayApi.GetPurposesQueryParams
    ): Promise<m2mGatewayApi.Purposes> => {
      const { eserviceIds, limit, offset } = queryParams;

      logger.info(
        `Retrieving purposes for eServiceIds ${eserviceIds} limit ${limit} offset ${offset}`
      );

      const {
        data: { results, totalCount },
      } = await purposeProcessClient.getPurposes({
        queries: {
          eservicesIds: eserviceIds,
          limit,
          offset,
        },
        headers,
      });

      return {
        results: results.map(toM2MPurpose),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    getPurpose: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      purposeId: PurposeId
    ): Promise<m2mGatewayApi.Purpose> => {
      logger.info(`Retrieving purpose with id ${purposeId}`);

      const { data } = await purposeProcessClient.getPurpose({
        params: {
          id: purposeId,
        },
        headers,
      });

      return toM2MPurpose(data);
    },
  };
}
