import { bffApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { AttributeId, TenantId } from "pagopa-interop-models";
import {
  AttributeProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  toBffApiCompactOrganization,
  toBffApiRequesterCertifiedAttributes,
} from "../model/api/tenantApiConverter.js";
import { getAllBulkAttributes } from "./attributeService.js";

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
    async getTenantAttributes(
      tenantId: string,
      attributeType: bffApi.AttributeKind,
      { headers }: WithLogger<BffAppContext>
    ) {
      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      const tenantAttributes = tenant.attributes
        .map((v) =>
          match(attributeType)
            .with(bffApi.AttributeKind.Values.CERTIFIED, () => v.certified)
            .with(bffApi.AttributeKind.Values.VERIFIED, () => v.verified)
            .with(bffApi.AttributeKind.Values.DECLARED, () => v.declared)
            .exhaustive()
        )
        .filter(isDefined);

      const attributeIds = tenantAttributes.map((v) => v.id);

      const registryAttributes = await getAllBulkAttributes(
        attributeRegistryProcessClient,
        headers,
        attributeIds
      );
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
