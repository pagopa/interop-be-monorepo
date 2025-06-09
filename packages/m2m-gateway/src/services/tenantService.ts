import { WithLogger, isDefined } from "pagopa-interop-commons";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { AttributeId, TenantId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toM2MGatewayApiTenantCertifiedAttribute,
  toGetTenantsApiQueryParams,
  toM2MGatewayApiTenant,
} from "../api/tenantApiConverter.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResourceWithMetadata,
} from "../utils/polling.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import { tenantCertifiedAttributeNotFound } from "../model/errors.js";

function retrieveCertifiedAttributes(
  tenant: tenantApi.Tenant
): tenantApi.CertifiedTenantAttribute[] {
  return tenant.attributes.map((v) => v.certified).filter(isDefined);
}

function retrieveCertifiedAttribute(
  tenant: tenantApi.Tenant,
  attributeId: tenantApi.CertifiedTenantAttribute["id"]
): tenantApi.CertifiedTenantAttribute {
  const certifiedAttribute = retrieveCertifiedAttributes(tenant).find(
    (certifiedAttribute) => certifiedAttribute.id === attributeId
  );

  if (!certifiedAttribute) {
    throw tenantCertifiedAttributeNotFound(tenant, attributeId);
  }

  return certifiedAttribute;
}

export type TenantService = ReturnType<typeof tenantServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(clients: PagoPAInteropBeClients) {
  const pollTenant = (
    response: WithMaybeMetadata<tenantApi.Tenant>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<tenantApi.Tenant>> =>
    pollResourceWithMetadata(() =>
      clients.tenantProcessClient.tenant.getTenant({
        params: { id: response.data.id },
        headers,
      })
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
    });

  return {
    async getTenants(
      queryParams: m2mGatewayApi.GetTenantsQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Tenants> {
      const { IPACode, taxCode, limit, offset } = queryParams;

      logger.info(
        `Retrieving tenants for IPACode ${IPACode} taxCode ${taxCode} limit ${limit} offset ${offset}`
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
    async getTenant(
      tenantId: TenantId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Tenant> {
      logger.info(`Retrieving tenant with id ${tenantId}`);

      const { data: tenant } =
        await clients.tenantProcessClient.tenant.getTenant({
          params: { id: tenantId },
          headers,
        });

      return toM2MGatewayApiTenant(tenant);
    },
    async getCertifiedAttributes(
      tenantId: TenantId,
      { limit, offset }: m2mGatewayApi.GetCertifiedAttributesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantCertifiedAttributes> {
      logger.info(`Retrieving tenant ${tenantId} certified attributes`);

      const { data: tenant } =
        await clients.tenantProcessClient.tenant.getTenant({
          params: { id: tenantId },
          headers,
        });

      const certifiedAttributes = retrieveCertifiedAttributes(tenant);

      const paginatedCertifiedAttributes = certifiedAttributes.slice(
        offset,
        offset + limit
      );

      return {
        results: paginatedCertifiedAttributes.map(
          toM2MGatewayApiTenantCertifiedAttribute
        ),
        pagination: {
          limit,
          offset,
          totalCount: certifiedAttributes.length,
        },
      };
    },
    async addCertifiedAttribute(
      tenantId: TenantId,
      seed: m2mGatewayApi.TenantCertifiedAttributeSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantCertifiedAttribute> {
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

      const { data: polledTenant } = await pollTenant(response, headers);
      const certifiedAttribute = retrieveCertifiedAttribute(
        polledTenant,
        seed.id
      );

      return toM2MGatewayApiTenantCertifiedAttribute(certifiedAttribute);
    },
    async revokeCertifiedAttribute(
      tenantId: TenantId,
      attributeId: AttributeId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantCertifiedAttribute> {
      logger.info(
        `Revoking certified attribute ${attributeId} from tenant ${tenantId}`
      );

      const response =
        await clients.tenantProcessClient.tenantAttribute.revokeCertifiedAttributeById(
          undefined,
          {
            params: { tenantId, attributeId },
            headers,
          }
        );

      const { data: polledTenant } = await pollTenant(response, headers);
      const certifiedAttribute = retrieveCertifiedAttribute(
        polledTenant,
        attributeId
      );

      return toM2MGatewayApiTenantCertifiedAttribute(certifiedAttribute);
    },
  };
}
