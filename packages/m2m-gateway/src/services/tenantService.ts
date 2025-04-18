import {
  getAllFromPaginated,
  WithLogger,
  isDefined,
  zipBy,
} from "pagopa-interop-commons";
import {
  attributeRegistryApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { TenantId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toM2MTenant,
  toM2MTenantCertifiedAttribute,
} from "../api/tenantApiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder({
  tenantProcessClient,
  attributeProcessClient,
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
    getCertifiedAttributes: async (
      tenantId: TenantId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantCertifiedAttributes> => {
      logger.info(`Retrieving tenant ${tenantId} certified attributes`);

      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      const tenantCertifiedAttributes = tenant.attributes
        .map((v) => v.certified)
        .filter(isDefined);

      const tenantCertifiedAttributeIds = tenantCertifiedAttributes.map(
        (att) => att.id
      );

      const certifiedAttributes =
        await getAllFromPaginated<attributeRegistryApi.Attribute>(
          async (offset, limit) =>
            await attributeProcessClient.getBulkedAttributes(
              tenantCertifiedAttributeIds,
              {
                headers,
                queries: {
                  offset,
                  limit,
                },
              }
            )
        );

      const combinedAttributes = zipBy(
        tenantCertifiedAttributes,
        certifiedAttributes,
        ({ id }) => id,
        ({ id }) => id
      );

      return {
        results: combinedAttributes.map((args) =>
          toM2MTenantCertifiedAttribute(...args)
        ),
      };
    },
  };
}
