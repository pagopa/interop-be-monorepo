import { apiGatewayApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { CatalogProcessClient } from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { toApiGatewayCatalogEservice } from "../api/catalogApiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function catalogServiceBuilder(
  catalogProcessClient: CatalogProcessClient
) {
  return {
    getEservices: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      { offset, limit }: apiGatewayApi.GetEServicesQueryParams
    ): Promise<apiGatewayApi.CatalogEServices> => {
      logger.info("Retrieving EServices");
      const paginatedEservices = await catalogProcessClient.getEServices({
        headers,
        queries: {
          offset,
          limit,
        },
      });

      return {
        results: paginatedEservices.results.map(toApiGatewayCatalogEservice),
        pagination: {
          offset,
          limit,
          totalCount: paginatedEservices.totalCount,
        },
      };
    },
  };
}
