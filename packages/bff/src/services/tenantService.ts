import { bffApi } from "pagopa-interop-api-clients";
import { isDefined, WithLogger } from "pagopa-interop-commons";
import { AttributeId, TenantId } from "pagopa-interop-models";
import {
  AttributeProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  RegistryAttributesMap,
  toBffApiCertifiedTenantAttributes,
  toBffApiCompactOrganization,
  toBffApiDeclaredTenantAttributes,
  toBffApiRequesterCertifiedAttributes,
  toBffApiTenant,
  toBffApiVerifiedTenantAttributes,
} from "../model/api/tenantApiConverter.js";
import { getAllBulkAttributes } from "./attributeService.js";

async function getRegistryAttributesMap(
  tenantAttributesIds: string[],
  attributeRegistryProcessClient: AttributeProcessClient,
  headers: WithLogger<BffAppContext>["headers"]
): Promise<RegistryAttributesMap> {
  const registryAttributes = await getAllBulkAttributes(
    attributeRegistryProcessClient,
    headers,
    tenantAttributesIds
  );

  return new Map(registryAttributes.map((a) => [a.id, a]));
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(
  tenantProcessClient: TenantProcessClient,
  attributeRegistryProcessClient: AttributeProcessClient
) {
  return {
    async getTenant(
      tenantId: TenantId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Tenant> {
      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      const certifiedAttributes = tenant.attributes
        .map((v) => v.certified)
        .filter(isDefined);

      const declaredAttributes = tenant.attributes
        .map((v) => v.declared)
        .filter(isDefined);

      const verifiedAttributes = tenant.attributes
        .map((v) => v.verified)
        .filter(isDefined);

      const allAttributeIds = [
        ...certifiedAttributes,
        ...declaredAttributes,
        ...verifiedAttributes,
      ].map((v) => v.id);

      const registryAttributesMap = await getRegistryAttributesMap(
        allAttributeIds,
        attributeRegistryProcessClient,
        headers
      );

      return toBffApiTenant(
        tenant,
        certifiedAttributes,
        declaredAttributes,
        verifiedAttributes,
        registryAttributesMap
      );
    },
    async getConsumers(
      name: string | undefined,
      offset: number,
      limit: number,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactOrganizations> {
      const { results, totalCount } =
        await tenantProcessClient.tenant.getConsumers({
          queries: {
            name,
            offset,
            limit,
          },
          headers,
        });

      return {
        results: results.map(toBffApiCompactOrganization),
        pagination: {
          offset,
          limit,
          totalCount,
        },
      };
    },
    async getProducers(
      name: string | undefined,
      offset: number,
      limit: number,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactOrganizations> {
      const { results, totalCount } =
        await tenantProcessClient.tenant.getProducers({
          queries: {
            name,
            offset,
            limit,
          },
          headers,
        });

      return {
        results: results.map(toBffApiCompactOrganization),
        pagination: {
          offset,
          limit,
          totalCount,
        },
      };
    },
    async getRequesterCertifiedAttributes(
      offset: number,
      limit: number,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.RequesterCertifiedAttributes> {
      const { results, totalCount } =
        await tenantProcessClient.tenant.getCertifiedAttributes({
          queries: {
            offset,
            limit,
          },
          headers,
        });

      return {
        results: results.map(toBffApiRequesterCertifiedAttributes),
        pagination: {
          offset,
          limit,
          totalCount,
        },
      };
    },
    async getCertifiedAttributes(
      tenantId: TenantId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CertifiedAttributesResponse> {
      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      const certifiedAttributes = tenant.attributes
        .map((v) => v.certified)
        .filter(isDefined);

      const registryAttributesMap = await getRegistryAttributesMap(
        certifiedAttributes.map((v) => v.id),
        attributeRegistryProcessClient,
        headers
      );

      const attributes = toBffApiCertifiedTenantAttributes(
        certifiedAttributes,
        registryAttributesMap
      );

      return { attributes };
    },
    async getDeclaredAttributes(
      tenantId: TenantId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.DeclaredAttributesResponse> {
      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      const declaredAttributes = tenant.attributes
        .map((v) => v.declared)
        .filter(isDefined);

      const registryAttributesMap = await getRegistryAttributesMap(
        declaredAttributes.map((v) => v.id),
        attributeRegistryProcessClient,
        headers
      );

      const attributes = toBffApiDeclaredTenantAttributes(
        declaredAttributes,
        registryAttributesMap
      );

      return { attributes };
    },
    async getVerifiedAttributes(
      tenantId: TenantId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.VerifiedAttributesResponse> {
      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      const verifiedAttributes = tenant.attributes
        .map((v) => v.verified)
        .filter(isDefined);

      const registryAttributesMap = await getRegistryAttributesMap(
        verifiedAttributes.map((v) => v.id),
        attributeRegistryProcessClient,
        headers
      );

      const attributes = toBffApiVerifiedTenantAttributes(
        verifiedAttributes,
        registryAttributesMap
      );

      return { attributes };
    },
    async addCertifiedAttribute(
      tenantId: TenantId,
      seed: bffApi.CertifiedTenantAttributeSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      await tenantProcessClient.tenantAttribute.addCertifiedAttribute(seed, {
        params: { tenantId },
        headers,
      });
    },
    async addDeclaredAttribute(
      seed: bffApi.DeclaredTenantAttributeSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      await tenantProcessClient.tenantAttribute.addDeclaredAttribute(seed, {
        headers,
      });
    },
    async verifyVerifiedAttribute(
      tenantId: TenantId,
      seed: bffApi.VerifiedTenantAttributeSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      await tenantProcessClient.tenantAttribute.verifyVerifiedAttribute(seed, {
        params: { tenantId },
        headers,
      });
    },
    async updateVerifiedAttribute(
      tenantId: TenantId,
      attributeId: AttributeId,
      seed: bffApi.UpdateVerifiedTenantAttributeSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      await tenantProcessClient.tenant.updateVerifiedAttribute(seed, {
        params: { tenantId, attributeId },
        headers,
      });
    },
    async revokeDeclaredAttribute(
      attributeId: AttributeId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      await tenantProcessClient.tenantAttribute.revokeDeclaredAttribute(
        undefined,
        {
          params: { attributeId },
          headers,
        }
      );
    },
    async revokeCertifiedAttribute(
      tenantId: TenantId,
      attributeId: AttributeId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      await tenantProcessClient.tenantAttribute.revokeCertifiedAttributeById(
        undefined,
        {
          params: { tenantId, attributeId },
          headers,
        }
      );
    },
    async revokeVerifiedAttribute(
      tenantId: TenantId,
      attributeId: AttributeId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      await tenantProcessClient.tenantAttribute.revokeVerifiedAttribute(
        undefined,
        {
          params: { tenantId, attributeId },
          headers,
        }
      );
    },
    async addTenantMail(
      tenantId: TenantId,
      seed: bffApi.MailSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      await tenantProcessClient.tenant.addTenantMail(seed, {
        params: { tenantId },
        headers,
      });
    },
    async deleteTenantMail(
      tenantId: TenantId,
      mailId: string,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      await tenantProcessClient.tenant.deleteTenantMail(undefined, {
        params: { tenantId, mailId },
        headers,
      });
    },
  };
}
