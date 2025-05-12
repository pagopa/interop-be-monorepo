import { WithLogger, isDefined, zipBy } from "pagopa-interop-commons";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { TenantId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toM2MGatewayApiTenantCertifiedAttribute,
  toGetTenantsApiQueryParams,
  toM2MGatewayApiTenant,
} from "../api/tenantApiConverter.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResource,
} from "../utils/polling.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";

export type TenantService = ReturnType<typeof tenantServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(clients: PagoPAInteropBeClients) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const pollTenant = (
    response: WithMaybeMetadata<tenantApi.Tenant>,
    headers: M2MGatewayAppContext["headers"]
  ) =>
    pollResource(() =>
      clients.tenantProcessClient.tenant.getTenant({
        params: { id: response.data.id },
        headers,
      })
    )({
      checkFn: isPolledVersionAtLeastResponseVersion(response),
    });
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
    getTenant: async (
      tenantId: TenantId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Tenant> => {
      logger.info(`Retrieving tenant with id ${tenantId}`);

      const { data: tenant } =
        await clients.tenantProcessClient.tenant.getTenant({
          params: { id: tenantId },
          headers,
        });

      return toM2MGatewayApiTenant(tenant);
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
        results: combinedAttributes.map(
          ([tenantCertifiedAttribute, certifiedAttribute]) =>
            toM2MGatewayApiTenantCertifiedAttribute(
              tenantCertifiedAttribute,
              certifiedAttribute
            )
        ),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    addCertifiedAttribute: async (
      tenantId: TenantId,
      seed: m2mGatewayApi.TenantCertifiedAttributeSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> => {
      logger.info(
        `Assigning certified attribute ${seed.id} to tenant ${tenantId}`
      );

      const response =
        await clients.tenantProcessClient.tenantAttribute.addCertifiedAttribute(
          seed,
          {
            params: { tenantId },
            headers,
          }
        );

      await pollTenant(response, headers);
    },
  };
}
