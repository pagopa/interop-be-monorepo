import { WithLogger, isDefined, zipBy } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { TenantId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toM2MGatewayApiTenantCertifiedAttribute,
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
    getCertifiedAttributes: async (
      tenantId: TenantId,
      { limit, offset }: m2mGatewayApi.GetCertifiedAttributesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantCertifiedAttributes> => {
      logger.info(`Retrieving tenant ${tenantId} certified attributes`);

      const { data: tenant } =
        await clients.tenantProcessClient.tenant.getTenant({
          params: { id: tenantId },
          headers,
        });

      const tenantCertifiedAttributes = tenant.attributes
        .map((v) => v.certified)
        .filter(isDefined);

      const tenantCertifiedAttributeIds = tenantCertifiedAttributes.map(
        (att) => att.id
      );

      const {
        data: { results: certifiedAttributes, totalCount },
      } = await clients.attributeProcessClient.getBulkedAttributes(
        tenantCertifiedAttributeIds,
        {
          headers,
          queries: {
            offset,
            limit,
          },
        }
      );

      const combinedAttributes = zipBy(
        tenantCertifiedAttributes,
        certifiedAttributes,
        ({ id }) => id,
        ({ id }) => id
      );

      return {
        results: combinedAttributes.map((args) =>
          toM2MGatewayApiTenantCertifiedAttribute(...args)
        ),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
  };
}
