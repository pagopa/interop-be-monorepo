import { eq, and, ilike, isNull, inArray } from "drizzle-orm";
import {
  Tenant,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Attribute,
  attributeKind,
} from "pagopa-interop-models";
import {
  AttributeReadModelService,
  TenantReadModelService,
  aggregateTenantArray,
  toTenantAggregatorArray,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  tenantInReadmodelTenant,
  attributeInReadmodelAttribute,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  attributeReadModelServiceSQL,
  tenantReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  attributeReadModelServiceSQL: AttributeReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
}) {
  return {
    getAttributes: async (): Promise<Attribute[]> =>
      (
        await attributeReadModelServiceSQL.getAttributesByFilter(
          and(
            eq(attributeInReadmodelAttribute.kind, attributeKind.certified),
            eq(
              attributeInReadmodelAttribute.origin,
              PUBLIC_ADMINISTRATIONS_IDENTIFIER
            )
          )
        )
      ).map((a) => a.data),
    getAttributeByExternalId: async (
      origin: string,
      code: string
    ): Promise<Attribute | undefined> => {
      const attributeWithMetadata =
        await attributeReadModelServiceSQL.getAttributeByFilter(
          and(
            eq(attributeInReadmodelAttribute.origin, origin),
            eq(attributeInReadmodelAttribute.code, code)
          )
        );

      return attributeWithMetadata?.data;
    },

    getTenantsByOriginPrefix: async (originPrefix: string): Promise<Tenant[]> =>
      await readModelDB.transaction(async (tx) => {
        const queryRes = await tx
          .select({ id: tenantInReadmodelTenant.id })
          .from(tenantInReadmodelTenant)
          .where(
            ilike(tenantInReadmodelTenant.externalIdOrigin, `${originPrefix}%`)
          );

        const tenantIds = queryRes.map((entry) => entry.id);
        if (tenantIds.length === 0) {
          return [];
        }

        const tenantsWithMetadata =
          await tenantReadModelServiceSQL.getTenantsByIds(tenantIds, tx);
        return tenantsWithMetadata.map((tenant) => tenant.data);
      }),

    async getTenantsWithAttributes(
      attributeIds: string[]
    ): Promise<Array<Tenant>> {
      const queryResult = await readModelDB
        .select({
          tenant: tenantInReadmodelTenant,
          certifiedAttribute: tenantCertifiedAttributeInReadmodelTenant,
          feature: tenantFeatureInReadmodelTenant,
        })
        .from(tenantInReadmodelTenant)
        .innerJoin(
          tenantCertifiedAttributeInReadmodelTenant,
          and(
            eq(
              tenantInReadmodelTenant.id,
              tenantCertifiedAttributeInReadmodelTenant.tenantId
            ),
            isNull(
              tenantCertifiedAttributeInReadmodelTenant.revocationTimestamp
            )
          )
        )
        .leftJoin(
          tenantFeatureInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantFeatureInReadmodelTenant.tenantId
          )
        )
        .where(
          inArray(
            tenantCertifiedAttributeInReadmodelTenant.attributeId,
            attributeIds
          )
        );

      const tenants = aggregateTenantArray(
        toTenantAggregatorArray(
          // eslint-disable-next-line sonarjs/no-identical-functions
          queryResult.map((entry) => ({
            ...entry,
            mail: null,
            declaredAttribute: null,
            verifiedAttribute: null,
            verifier: null,
            revoker: null,
          }))
        )
      );

      return tenants.map((tenant) => tenant.data);
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
