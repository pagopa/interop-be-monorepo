import {
  getAllFromPaginated,
  WithLogger,
  isDefined,
  zipBy,
} from "pagopa-interop-commons";
import {
  attributeRegistryApi,
  m2mGatewayApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { AttributeId, TenantId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toM2MTenant,
  toM2MTenantCertifiedAttribute,
} from "../api/tenantApiConverter.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResource,
} from "../utils/polling.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder({
  tenantProcessClient,
  attributeProcessClient,
}: PagoPAInteropBeClients) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const pollTenant = (
    response: WithMaybeMetadata<tenantApi.Tenant>,
    headers: M2MGatewayAppContext["headers"]
  ) =>
    pollResource(() =>
      tenantProcessClient.tenant.getTenant({
        params: { id: response.data.id },
        headers,
      })
    )({
      checkFn: isPolledVersionAtLeastResponseVersion(response),
    });

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
    getTenant: async (
      tenantId: TenantId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Tenant> => {
      logger.info(`Retrieving tenant with id ${tenantId}`);

      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      return toM2MTenant(tenant);
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
    addCertifiedAttribute: async (
      tenantId: TenantId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      seed: m2mGatewayApi.TenantCertifiedAttributeSeed
    ): Promise<void> => {
      logger.info(
        `Assigning certified attribute ${seed.id} to tenant ${tenantId}`
      );

      const response =
        await tenantProcessClient.tenantAttribute.addCertifiedAttribute(seed, {
          params: { tenantId },
          headers,
        });

      await pollTenant(response, headers);
    },
    revokeCertifiedAttribute: async (
      tenantId: TenantId,
      attributeId: AttributeId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> => {
      logger.info(
        `Revoking certified attribute ${attributeId} from tenant ${tenantId}`
      );

      const response =
        await tenantProcessClient.tenantAttribute.revokeCertifiedAttributeById(
          undefined,
          {
            params: { tenantId, attributeId },
            headers,
          }
        );

      await pollTenant(response, headers);
    },
  };
}
