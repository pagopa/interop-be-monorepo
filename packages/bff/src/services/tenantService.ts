import { bffApi, tenantApi } from "pagopa-interop-api-clients";
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
  toBffApiVerifiedTenantAttributes,
} from "../model/api/tenantApiConverter.js";
import { getAllBulkAttributes } from "./attributeService.js";

async function getRegistryAttributesMap(
  tenantAttributes:
    | tenantApi.CertifiedTenantAttribute[]
    | tenantApi.DeclaredTenantAttribute[]
    | tenantApi.VerifiedTenantAttribute[],
  attributeRegistryProcessClient: AttributeProcessClient,
  headers: WithLogger<BffAppContext>["headers"]
): Promise<RegistryAttributesMap> {
  const attributeIds = tenantAttributes.map((v) => v.id);

  const registryAttributes = await getAllBulkAttributes(
    attributeRegistryProcessClient,
    headers,
    attributeIds
  );

  return new Map(registryAttributes.map((a) => [a.id, a]));
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(
  tenantProcessClient: TenantProcessClient,
  attributeRegistryProcessClient: AttributeProcessClient
) {
  return {
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
        certifiedAttributes,
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
        declaredAttributes,
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
        verifiedAttributes,
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
      tenantId: string,
      seed: bffApi.VerifiedTenantAttributeSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      await tenantProcessClient.tenantAttribute.verifyVerifiedAttribute(seed, {
        params: { tenantId },
        headers,
      });
    },
    async updateVerifiedAttribute(
      tenantId: string,
      attributeId: string,
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
  };
}
