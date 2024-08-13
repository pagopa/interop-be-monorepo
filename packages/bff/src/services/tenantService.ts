import { bffApi } from "pagopa-interop-api-clients";
import { WithLogger, filterUndefined } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  AttributeProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  toBffApiCompactOrganization,
  toBffApiRequesterCertifiedAttributes,
} from "../model/domain/apiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(
  tenantProcessClient: TenantProcessClient,
  attributeProcessClient: AttributeProcessClient
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
      type: "certified",
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CertifiedTenantAttribute[]> {
      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });
      const tenantAttribute = tenant.attributes
        .map((a) =>
          match(type)
            .with("certified", () => a.certified)
            .otherwise(() => undefined)
        )
        .filter(filterUndefined);

      const registryAttributes =
        await attributeProcessClient.getBulkedAttributes(
          tenantAttribute.map((a) => a.id),
          {
            // TODO: something is not ok here. Fix it!
            queries: {
              offset: 0,
              limit: 0,
            },
            headers,
          }
        );

      const registryMap = new Map(
        registryAttributes.results.map((a) => [a.id, a])
      );

      return tenantAttribute
        .map<bffApi.CertifiedTenantAttribute | undefined>((ta) => {
          const ra = registryMap.get(ta.id);
          return (
            ra && {
              name: ra.name,
              description: ra.description,
              id: ta.id,
              assignmentTimestamp: ta.assignmentTimestamp,
              expirationTimestamp: ta.expirationTimestamp,
            }
          );
        })
        .filter(filterUndefined);
    },
    async addCertifiedAttribute(
      tenantId: string,
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
      attributeId: string,
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
    async revokeCertifiedAttributeById(
      tenantId: string,
      attributeId: string,
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
      tenantId: string,
      attributeId: string,
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
