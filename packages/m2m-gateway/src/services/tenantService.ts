import {
  M2MAdminAuthData,
  WithLogger,
  isDefined,
} from "pagopa-interop-commons";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import {
  AgreementId,
  AttributeId,
  DelegationId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toM2MGatewayApiTenantCertifiedAttribute,
  toGetTenantsApiQueryParams,
  toM2MGatewayApiTenant,
  toM2MGatewayApiTenantVerifiedAttribute,
  toM2MGatewayApiTenantDeclaredAttribute,
  toM2MGatewayApiTenantVerifier,
  toM2MGatewayApiTenantRevoker,
} from "../api/tenantApiConverter.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResourceWithMetadata,
} from "../utils/polling.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  tenantCertifiedAttributeNotFound,
  tenantDeclaredAttributeNotFound,
  tenantVerifiedAttributeNotFound,
} from "../model/errors.js";
import {
  assertTenantCanEditDeclaredAttributes,
  assertTenantIsSelf,
} from "../utils/validators/tenantValidators.js";

function retrieveDeclaredAttributes(
  tenant: tenantApi.Tenant
): tenantApi.DeclaredTenantAttribute[] {
  return tenant.attributes.map((v) => v.declared).filter(isDefined);
}

function retrieveDeclaredAttribute(
  tenant: tenantApi.Tenant,
  attributeId: tenantApi.DeclaredTenantAttribute["id"]
): tenantApi.DeclaredTenantAttribute {
  const declaredAttribute = retrieveDeclaredAttributes(tenant).find(
    (declaredAttribute) => declaredAttribute.id === attributeId
  );

  if (!declaredAttribute) {
    throw tenantDeclaredAttributeNotFound(tenant, attributeId);
  }

  return declaredAttribute;
}

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

function retrieveVerifiedAttributes(
  tenant: tenantApi.Tenant
): tenantApi.VerifiedTenantAttribute[] {
  return tenant.attributes.map((v) => v.verified).filter(isDefined);
}

function retrieveVerifiedAttribute(
  tenant: tenantApi.Tenant,
  attributeId: tenantApi.VerifiedTenantAttribute["id"]
): tenantApi.VerifiedTenantAttribute {
  const verifiedAttribute = retrieveVerifiedAttributes(tenant).find(
    (verifiedAttribute) => verifiedAttribute.id === attributeId
  );

  if (!verifiedAttribute) {
    throw tenantVerifiedAttributeNotFound(tenant, attributeId);
  }

  return verifiedAttribute;
}

export type TenantService = ReturnType<typeof tenantServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(clients: PagoPAInteropBeClients) {
  const retrieveTenantById = async (
    tenantId: string,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<tenantApi.Tenant>> =>
    await clients.tenantProcessClient.tenant.getTenant({
      params: { id: tenantId },
      headers,
    });

  const pollTenant = (
    response: WithMaybeMetadata<tenantApi.Tenant>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<tenantApi.Tenant>> =>
    pollResourceWithMetadata(() =>
      retrieveTenantById(response.data.id, headers)
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

      const { data: tenant } = await retrieveTenantById(tenantId, headers);

      return toM2MGatewayApiTenant(tenant);
    },
    async getTenantDeclaredAttributes(
      tenantId: TenantId,
      {
        delegationId,
        limit,
        offset,
      }: m2mGatewayApi.GetTenantDeclaredAttributesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantDeclaredAttributes> {
      logger.info(`Retrieving tenant ${tenantId} declared attributes`);

      const { data: tenant } = await retrieveTenantById(tenantId, headers);

      const declaredAttributes = retrieveDeclaredAttributes(tenant);

      const filteredDeclaredAttributes = delegationId
        ? declaredAttributes.filter(
            (declaredAttribute) =>
              declaredAttribute.delegationId === delegationId
          )
        : declaredAttributes;

      const paginatedDeclaredAttributes = filteredDeclaredAttributes.slice(
        offset,
        offset + limit
      );

      return {
        results: paginatedDeclaredAttributes.map(
          toM2MGatewayApiTenantDeclaredAttribute
        ),
        pagination: {
          limit,
          offset,
          totalCount: filteredDeclaredAttributes.length,
        },
      };
    },
    async assignTenantDeclaredAttribute(
      tenantId: TenantId,
      {
        id: attributeId,
        delegationId,
      }: m2mGatewayApi.TenantDeclaredAttributeSeed,
      {
        logger,
        headers,
        authData,
      }: WithLogger<M2MGatewayAppContext<M2MAdminAuthData>>
    ): Promise<m2mGatewayApi.TenantDeclaredAttribute> {
      logger.info(
        `Assigning declared attribute ${attributeId} to tenant ${tenantId}`
      );

      await assertTenantCanEditDeclaredAttributes(
        authData,
        tenantId,
        delegationId ? unsafeBrandId<DelegationId>(delegationId) : undefined,
        clients.delegationProcessClient,
        headers
      );

      const response =
        await clients.tenantProcessClient.tenantAttribute.addDeclaredAttribute(
          {
            id: attributeId,
            delegationId,
          },
          {
            headers,
          }
        );

      const { data: polledTenant } = await pollTenant(response, headers);

      const declaredAttribute = retrieveDeclaredAttribute(
        polledTenant,
        attributeId
      );

      return toM2MGatewayApiTenantDeclaredAttribute(declaredAttribute);
    },
    async revokeTenantDeclaredAttribute(
      tenantId: TenantId,
      attributeId: AttributeId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantDeclaredAttribute> {
      logger.info(
        `Revoking declared attribute ${attributeId} from tenant ${tenantId}`
      );

      const response =
        await clients.tenantProcessClient.tenantAttribute.revokeDeclaredAttribute(
          undefined,
          {
            params: { attributeId },
            headers,
          }
        );

      const { data: polledTenant } = await pollTenant(response, headers);

      const declaredAttribute = retrieveDeclaredAttribute(
        polledTenant,
        attributeId
      );

      return toM2MGatewayApiTenantDeclaredAttribute(declaredAttribute);
    },
    async getTenantCertifiedAttributes(
      tenantId: TenantId,
      { limit, offset }: m2mGatewayApi.GetTenantCertifiedAttributesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantCertifiedAttributes> {
      logger.info(`Retrieving tenant ${tenantId} certified attributes`);

      const { data: tenant } = await retrieveTenantById(tenantId, headers);

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
    async assignTenantCertifiedAttribute(
      tenantId: TenantId,
      { id: attributeId }: m2mGatewayApi.TenantCertifiedAttributeSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantCertifiedAttribute> {
      logger.info(
        `Assigning certified attribute ${attributeId} to tenant ${tenantId}`
      );

      const response =
        await clients.tenantProcessClient.tenantAttribute.addCertifiedAttribute(
          { id: attributeId },
          {
            params: { tenantId },
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
    async revokeTenantCertifiedAttribute(
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
    async getTenantVerifiedAttributes(
      tenantId: TenantId,
      { limit, offset }: m2mGatewayApi.GetTenantVerifiedAttributesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantVerifiedAttributes> {
      logger.info(`Retrieving tenant ${tenantId} verified attributes`);

      const { data: tenant } = await retrieveTenantById(tenantId, headers);

      const verifiedAttributes = retrieveVerifiedAttributes(tenant);

      const paginatedVerifiedAttributes = verifiedAttributes.slice(
        offset,
        offset + limit
      );

      return {
        results: paginatedVerifiedAttributes.map(
          toM2MGatewayApiTenantVerifiedAttribute
        ),
        pagination: {
          limit,
          offset,
          totalCount: verifiedAttributes.length,
        },
      };
    },
    async getTenantVerifiedAttributeVerifiers(
      tenantId: TenantId,
      attributeId: AttributeId,
      {
        limit,
        offset,
      }: m2mGatewayApi.GetTenantVerifiedAttributeVerifiersQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantVerifiedAttributeVerifiers> {
      logger.info(
        `Retrieving verifiers for verified attribute ${attributeId} of tenant ${tenantId}`
      );

      const {
        data: { results, totalCount },
      } =
        await clients.tenantProcessClient.tenant.getTenantVerifiedAttributeVerifiers(
          {
            params: { tenantId, attributeId },
            queries: { limit, offset },
            headers,
          }
        );

      return {
        results: results.map(toM2MGatewayApiTenantVerifier),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    async getTenantVerifiedAttributeRevokers(
      tenantId: TenantId,
      attributeId: AttributeId,
      {
        limit,
        offset,
      }: m2mGatewayApi.GetTenantVerifiedAttributeRevokersQueryParams,
      { logger, headers, authData }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantVerifiedAttributeRevokers> {
      logger.info(
        `Retrieving revokers for verified attribute ${attributeId} of tenant ${tenantId}`
      );

      assertTenantIsSelf(authData, tenantId);

      const {
        data: { results, totalCount },
      } =
        await clients.tenantProcessClient.tenant.getTenantVerifiedAttributeRevokers(
          {
            params: { tenantId, attributeId },
            queries: { limit, offset },
            headers,
          }
        );

      return {
        results: results.map(toM2MGatewayApiTenantRevoker),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    async assignTenantVerifiedAttribute(
      tenantId: TenantId,
      {
        id: attributeId,
        agreementId,
        expirationDate,
      }: m2mGatewayApi.TenantVerifiedAttributeSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantVerifiedAttribute> {
      logger.info(
        `Assigning verified attribute ${attributeId} to tenant ${tenantId}`
      );

      const response =
        await clients.tenantProcessClient.tenantAttribute.verifyVerifiedAttribute(
          {
            id: attributeId,
            agreementId,
            expirationDate,
          },
          {
            params: { tenantId },
            headers,
          }
        );

      const { data: polledTenant } = await pollTenant(response, headers);

      const verifiedAttribute = retrieveVerifiedAttribute(
        polledTenant,
        attributeId
      );

      return toM2MGatewayApiTenantVerifiedAttribute(verifiedAttribute);
    },
    async revokeTenantVerifiedAttribute(
      tenantId: TenantId,
      attributeId: AttributeId,
      agreementId: AgreementId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.TenantVerifiedAttribute> {
      logger.info(
        `Revoking verified attribute ${attributeId} from tenant ${tenantId}`
      );

      const response =
        await clients.tenantProcessClient.tenantAttribute.revokeVerifiedAttribute(
          {
            agreementId,
          },
          {
            params: { tenantId, attributeId },
            headers,
          }
        );

      const { data: polledTenant } = await pollTenant(response, headers);

      const verifiedAttribute = retrieveVerifiedAttribute(
        polledTenant,
        attributeId
      );

      return toM2MGatewayApiTenantVerifiedAttribute(verifiedAttribute);
    },
  };
}
