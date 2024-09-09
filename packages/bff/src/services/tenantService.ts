import {
  attributeRegistryApi,
  bffApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { AttributeId, TenantId } from "pagopa-interop-models";
import { TenantProcessClient } from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  toBffApiCompactOrganization,
  toBffApiRequesterCertifiedAttributes,
} from "../model/api/tenantApiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(tenantProcessClient: TenantProcessClient) {
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

export function enhanceTenantAttributes(
  tenantAttributes: tenantApi.TenantAttribute[],
  registryAttributes: attributeRegistryApi.Attribute[]
): bffApi.TenantAttributes {
  const registryAttributesMap: Map<string, bffApi.Attribute> = new Map(
    registryAttributes.map((attribute) => [attribute.id, attribute])
  );

  const declared = tenantAttributes
    .map((attr) => getDeclaredTenantAttribute(attr, registryAttributesMap))
    .filter((x): x is bffApi.DeclaredTenantAttribute => x !== undefined);

  const certified = tenantAttributes
    .map((attr) => getCertifiedTenantAttribute(attr, registryAttributesMap))
    .filter((x): x is bffApi.CertifiedTenantAttribute => x !== undefined);

  const verified = tenantAttributes
    .map((attr) => toApiVerifiedTenantAttribute(attr, registryAttributesMap))
    .filter((x): x is bffApi.VerifiedTenantAttribute => x !== undefined);

  return {
    certified,
    declared,
    verified,
  };
}

export function getDeclaredTenantAttribute(
  attribute: tenantApi.TenantAttribute,
  registryAttributeMap: Map<string, attributeRegistryApi.Attribute>
): bffApi.DeclaredTenantAttribute | undefined {
  if (!attribute.declared) {
    return undefined;
  }
  const registryAttribute = registryAttributeMap.get(attribute.declared.id);
  if (!registryAttribute) {
    return undefined;
  }

  return {
    id: attribute.declared.id,
    name: registryAttribute.name,
    description: registryAttribute.description,
    assignmentTimestamp: attribute.declared.assignmentTimestamp,
    revocationTimestamp: attribute.declared.revocationTimestamp,
  };
}

export function getCertifiedTenantAttribute(
  attribute: tenantApi.TenantAttribute,
  registryAttributeMap: Map<string, attributeRegistryApi.Attribute>
): bffApi.CertifiedTenantAttribute | undefined {
  if (!attribute.certified) {
    return undefined;
  }
  const registryAttribute = registryAttributeMap.get(attribute.certified.id);
  if (!registryAttribute) {
    return undefined;
  }

  return {
    id: attribute.certified.id,
    name: registryAttribute.name,
    description: registryAttribute.description,
    assignmentTimestamp: attribute.certified.assignmentTimestamp,
    revocationTimestamp: attribute.certified.revocationTimestamp,
  };
}

export function toApiVerifiedTenantAttribute(
  attribute: tenantApi.TenantAttribute,
  registryAttributeMap: Map<string, attributeRegistryApi.Attribute>
): bffApi.VerifiedTenantAttribute | undefined {
  if (!attribute.verified) {
    return undefined;
  }
  const registryAttribute = registryAttributeMap.get(attribute.verified.id);
  if (!registryAttribute) {
    return undefined;
  }

  return {
    id: attribute.verified.id,
    name: registryAttribute.name,
    description: registryAttribute.description,
    assignmentTimestamp: attribute.verified.assignmentTimestamp,
    verifiedBy: attribute.verified.verifiedBy,
    revokedBy: attribute.verified.revokedBy,
  };
}
