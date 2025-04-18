import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { toM2MTenant } from "../api/tenantApiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder({
  tenantProcessClient,
}: PagoPAInteropBeClients) {
  return {
    getTenants: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      queryParams: m2mGatewayApi.GetTenantsQueryParams
    ): Promise<m2mGatewayApi.Tenants> => {
      const { externalIdOrigin, externalIdValue, limit, offset } = queryParams;

      logger.info(
        `Retrieving tenants for externalIdOrigin ${externalIdOrigin} externalIdValue ${externalIdValue} limit ${limit} offset ${offset}`
      );

      const { results, totalCount } =
        await tenantProcessClient.tenant.getTenants({
          queries: {
            externalIdOrigin,
            externalIdValue,
            limit,
            offset,
          },
          headers,
        });

      return {
        results: results.map(toM2MTenant),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
  };
}
