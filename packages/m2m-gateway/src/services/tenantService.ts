import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toGetTenantsApiQueryParams,
  toM2MGatewayApiTenant,
} from "../api/tenantApiConverter.js";

export type TenantService = ReturnType<typeof tenantServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    getTenants: async (
      queryParams: m2mGatewayApi.GetTenantsQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Tenants> => {
      const { externalIdOrigin, externalIdValue, limit, offset } = queryParams;

      logger.info(
        `Retrieving tenants for externalIdOrigin ${externalIdOrigin} externalIdValue ${externalIdValue} limit ${limit} offset ${offset}`
      );

      const {
        data: { results, totalCount },
      } = await clients.tenantProcessClient.tenant.getTenants({
        queries: toGetTenantsApiQueryParams(queryParams),
        headers,
      });

      return {
        results: results.map(toM2MGatewayApiTenant),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
  };
}
